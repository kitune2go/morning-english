package jp.morningenglish.subtitle;

import android.graphics.Bitmap;
import android.graphics.Rect;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** In-memory OCR + English -> Japanese translation; never uploads or persists source text. */
final class ReadingEngine {
    interface Listener {
        void onStatus(String status);
        void onSource(String original);
        void onSentence(String english, String japanese);
        void onWord(String english, String japanese);
        void onError(String error);
        void onDone();
    }

    private final Translator translator = Translation.getClient(
        new TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.ENGLISH)
            .setTargetLanguage(TranslateLanguage.JAPANESE).build());
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private long generation = 0;
    private static final Pattern WORD = Pattern.compile("[A-Za-z][A-Za-z'-]*");
    private static final Set<String> STOP = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "about","after","again","also","among","another","because","before","being",
        "could","every","first","from","have","into","little","more","much","must",
        "other","over","same","shall","should","some","such","than","that","their",
        "them","there","these","they","this","those","through","very","were","what",
        "when","where","which","while","will","with","would","your","you","and",
        "the","for","but","not","are","was","had","has","did","does","him","her",
        "his","its","our","all","one","two","who","why","how","can","may","out"
    )));

    void readImage(Bitmap bitmap, Listener listener) {
        listener.onStatus("画面内の英文を認識しています…");
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(result -> {
                List<Text.TextBlock> blocks = new ArrayList<>(result.getTextBlocks());
                blocks.sort((a,b)->{
                    Rect ar=a.getBoundingBox(),br=b.getBoundingBox();
                    int ay=ar==null?0:ar.top, by=br==null?0:br.top;
                    if(Math.abs(ay-by)>24)return Integer.compare(ay,by);
                    return Integer.compare(ar==null?0:ar.left,br==null?0:br.left);
                });
                StringBuilder source = new StringBuilder();
                for(Text.TextBlock block:blocks){
                    Rect rect=block.getBoundingBox();
                    if(rect!=null && rect.top < bitmap.getHeight()*0.06f)continue;
                    String line=block.getText().replace('\n',' ').trim();
                    if(line.length()>=15 && line.matches("(?s).*[A-Za-z]{3}.*")){
                        if(source.length()>0)source.append(' ');
                        source.append(line);
                    }
                    if(source.length()>=850)break;
                }
                if(source.length()<15){
                    listener.onError("英文が取得できませんでした。文字の大きさや画面共有範囲を確認してください。保護された画面は取得できません。");
                    return;
                }
                translate(source.toString(), listener);
            })
            .addOnFailureListener(e->listener.onError("文字認識エラー: "+e.getMessage()))
            .addOnCompleteListener(task -> bitmap.recycle());
    }

    void translate(String input, Listener listener){
        long job=++generation;
        String raw=input.replaceAll("\\s+"," ").trim();
        if(raw.isEmpty()){listener.onError("英文がありません。");return;}
        if(raw.length()>1000)raw=raw.substring(0,1000);
        final String original=raw;
        listener.onSource(original);
        listener.onStatus("翻訳モデルを準備しています（初回はダウンロードが必要です）…");
        translator.downloadModelIfNeeded()
            .addOnSuccessListener(v->{
                if(job!=generation)return;
                List<String> sentences=splitSentences(original);
                listener.onStatus("和訳を生成しています…");
                translateSentences(job,sentences,0,original,listener);
            })
            .addOnFailureListener(e->{if(job==generation)listener.onError("モデルを準備できません: "+e.getMessage());});
    }

    private static List<String> splitSentences(String text){
        List<String> result=new ArrayList<>();
        for(String piece:text.split("(?<=[.!?])\\s+")){
            if(result.size()>=4)break;
            piece=piece.trim();
            if(piece.isEmpty())continue;
            // Cap one subtitle unit; never split mid-token.
            while(piece.length()>200 && result.size()<4){
                int cut=piece.lastIndexOf(' ',200);
                if(cut<60)cut=200;
                result.add(piece.substring(0,cut).trim());
                piece=piece.substring(cut).trim();
            }
            if(result.size()<4 && !piece.isEmpty())result.add(piece);
        }
        return result;
    }

    private void translateSentences(long job,List<String> sentences,int index,String source,Listener listener){
        if(job!=generation)return;
        if(index>=sentences.size()){
            listener.onStatus("重要そうな語句の簡易訳を確認しています…");
            translateWords(job,new ArrayList<>(candidateWords(source)),0,listener);
            return;
        }
        String en=sentences.get(index);
        translator.translate(en)
            .addOnSuccessListener(ja->{
                if(job!=generation)return;
                listener.onSentence(en,ja);
                translateSentences(job,sentences,index+1,source,listener);
            }).addOnFailureListener(e->{
                if(job==generation)listener.onError("和訳に失敗しました: "+e.getMessage());
            });
    }

    private static LinkedHashSet<String> candidateWords(String original){
        LinkedHashSet<String> found=new LinkedHashSet<>();
        Matcher matcher=WORD.matcher(original);
        while(matcher.find() && found.size()<6){
            String word=matcher.group().toLowerCase(Locale.ROOT);
            if(word.length()<5||word.length()>18||STOP.contains(word))continue;
            if(matcher.start()>0 && ".!?".indexOf(original.charAt(matcher.start()-1))>=0)continue;
            found.add(word);
        }
        return found;
    }

    private void translateWords(long job,List<String> words,int index,Listener listener){
        if(job!=generation)return;
        if(index>=words.size()){
            listener.onStatus("完了：本文と語義を表示しています");
            listener.onDone();
            return;
        }
        String word=words.get(index);
        translator.translate(word).addOnSuccessListener(ja->{
            if(job!=generation)return;
            listener.onWord(word,ja);
            translateWords(job,words,index+1,listener);
        }).addOnFailureListener(e->{
            if(job==generation)translateWords(job,words,index+1,listener);
        });
    }

    void close(){generation++;recognizer.close();translator.close();}
}
