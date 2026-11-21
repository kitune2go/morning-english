package jp.morningenglish.subtitle;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final int SCREEN_REQUEST = 101;
    private EditText editor;
    private LinearLayout preview;
    private TextView status;
    private ReadingEngine engine;
    private int green = Color.rgb(27,84,73);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        engine = new ReadingEngine();
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(248,247,242));
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22),dp(26),dp(22),dp(40));
        scroll.addView(root);
        label(root,"読書字幕",28,true,green);
        label(root,"洋書を開いたまま、原文と日本語訳・単語の意味を画面下に表示する実験版です。",15,false,Color.DKGRAY);
        label(root,"① 画面内表示を許可",19,true,green);
        button(root,"ほかのアプリの上に表示する権限を開く",()->{
            Intent intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:"+getPackageName()));
            startActivity(intent);
        });
        label(root,"② Kindleなどを開いた画面を字幕化",19,true,green);
        label(root,"画面共有は毎回OSが確認します。「画面全体」を共有できる場合はそれを選んでください。開始後、Kindleに移動し、字幕パネルの「読取」を押します。",13,false,Color.DKGRAY);
        button(root,"画面共有を許可して字幕パネルを開始",()->beginProjection());
        button(root,"字幕パネルを停止",()->{
            startService(new Intent(this,OverlayService.class).setAction(OverlayService.STOP));
            status.setText("停止を要求しました");
        });
        label(root,"③ 貼り付けた英文だけで翻訳テスト",19,true,green);
        editor=new EditText(this);
        editor.setMinLines(3);
        editor.setMaxLines(7);
        editor.setTextSize(15);
        editor.setPadding(dp(12),dp(10),dp(12),dp(10));
        editor.setBackgroundColor(Color.WHITE);
        editor.setText("The child opened the old book. A quiet light filled the room. She wondered what stories it held.");
        root.addView(editor,new LinearLayout.LayoutParams(-1,-2));
        button(root,"この英文を端末内で翻訳",()->showPreview());
        status=label(root,"モデルは初回ダウンロードが必要です。",13,false,green);
        preview=new LinearLayout(this);
        preview.setOrientation(LinearLayout.VERTICAL);
        root.addView(preview);
        label(root,"プライバシー：画面画像と文章は保存・外部送信しません。OCRは端末内で処理し、翻訳にはML Kitの端末内モデルを使用します。モデルの初回取得には通信が必要です。",12,false,Color.DKGRAY);
        label(root,"注意：コピー・撮影が制限された書籍画面には対応できません。閲覧権限の回避は行いません。",12,false,Color.rgb(135,68,35));
        setContentView(scroll);
        populateSharedText(getIntent());
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},108);
        }
    }

    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        populateSharedText(intent);
    }
    private void populateSharedText(Intent intent){
        if(Intent.ACTION_SEND.equals(intent.getAction())&&"text/plain".equals(intent.getType())){
            String shared=intent.getStringExtra(Intent.EXTRA_TEXT);
            if(shared!=null&&!shared.trim().isEmpty())editor.setText(shared);
        }
    }
    private void showPreview(){
        preview.removeAllViews();
        engine.translate(editor.getText().toString(),new ReadingEngine.Listener(){
            public void onStatus(String s){status.setText(s);}
            public void onSource(String en){label(preview,"ORIGINAL  /  "+en,14,true,green);}
            public void onSentence(String en,String ja){
                label(preview,en,14,true,Color.DKGRAY);
                label(preview,ja,17,false,green);
            }
            public void onWord(String en,String ja){label(preview,en+"  →  "+ja,14,false,Color.rgb(85,61,120));}
            public void onError(String s){status.setText(s);}
            public void onDone(){}
        });
    }
    private void beginProjection(){
        if(!Settings.canDrawOverlays(this)){
            status.setText("最初に『ほかのアプリの上に表示』を許可してください。");
            return;
        }
        MediaProjectionManager mgr=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
        if(mgr!=null)startActivityForResult(mgr.createScreenCaptureIntent(),SCREEN_REQUEST);
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==SCREEN_REQUEST){
            if(resultCode!=RESULT_OK||data==null){status.setText("画面共有はキャンセルされました。");return;}
            Intent i=new Intent(this,OverlayService.class)
                .setAction(OverlayService.BEGIN)
                .putExtra(OverlayService.RESULT_CODE,resultCode)
                .putExtra(OverlayService.RESULT_DATA,data);
            if(Build.VERSION.SDK_INT>=26)startForegroundService(i);
            else startService(i);
            status.setText("字幕を起動しました。Kindleなどの読書画面へ移動してください。");
        }
    }
    private TextView label(LinearLayout root,String text,int sp,boolean bold,int color){
        TextView v=new TextView(this);
        v.setText(text);v.setTextSize(sp);v.setTextColor(color);
        if(bold)v.setTypeface(null,1);
        v.setPadding(0,dp(11),0,dp(6));
        root.addView(v,new LinearLayout.LayoutParams(-1,-2));
        return v;
    }
    private void button(LinearLayout root,String name,Runnable click){
        Button b=new Button(this);b.setText(name);b.setAllCaps(false);
        root.addView(b,new LinearLayout.LayoutParams(-1,-2));b.setOnClickListener(v->click.run());
    }
    private int dp(int d){return Math.round(getResources().getDisplayMetrics().density*d);}
    @Override protected void onDestroy(){
        if(engine!=null)engine.close();
        super.onDestroy();
    }
}
