package jp.morningenglish.subtitle;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.nio.ByteBuffer;

/** One user-authorized screen capture session; no background OCR loop or persistent storage. */
public final class OverlayService extends Service {
    static final String BEGIN="jp.morningenglish.subtitle.BEGIN";
    static final String STOP="jp.morningenglish.subtitle.STOP";
    static final String RESULT_CODE="code";
    static final String RESULT_DATA="data";
    private static final String CHANNEL="reader_projection";
    private static final int NOTICE=1008;
    private final Handler ui=new Handler(Looper.getMainLooper());
    private MediaProjection projection;
    private MediaProjection.Callback projectionCallback;
    private VirtualDisplay display;
    private ImageReader imageReader;
    private WindowManager wm;
    private WindowManager.LayoutParams params;
    private LinearLayout window;
    private LinearLayout lines;
    private LinearLayout words;
    private TextView status;
    private Button foldButton;
    private ReadingEngine engine;
    private boolean folded=false;
    private boolean busy=false;
    private boolean stopping=false;

    @Override public IBinder onBind(Intent i){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null)return START_NOT_STICKY;
        if(STOP.equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
        if(!BEGIN.equals(intent.getAction()))return START_NOT_STICKY;
        if(projection!=null){setStatus("すでに字幕が起動中です。");return START_NOT_STICKY;}
        if(!Settings.canDrawOverlays(this)){stopSelf();return START_NOT_STICKY;}
        int result=intent.getIntExtra(RESULT_CODE,0);
        Intent data;
        if(Build.VERSION.SDK_INT>=33){data=intent.getParcelableExtra(RESULT_DATA,Intent.class);}
        else { data=(Intent)intent.getParcelableExtra(RESULT_DATA); }
        if(result==0||data==null){stopSelf();return START_NOT_STICKY;}
        try {
            startForegroundProjection();
            engine=new ReadingEngine();
            createPanel();
            MediaProjectionManager pm=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
            if(pm==null)throw new IllegalStateException("画面共有が利用できません");
            projection=pm.getMediaProjection(result,data);
            if(projection==null)throw new IllegalStateException("画面共有に失敗しました");
            projectionCallback=new MediaProjection.Callback(){
                @Override public void onStop(){ui.post(()->{setStatus("画面共有が終了しました");stopSelf();});}
            };
            projection.registerCallback(projectionCallback,ui);
            DisplayMetrics metrics=getResources().getDisplayMetrics();
            WindowManager manager=(WindowManager)getSystemService(WINDOW_SERVICE);
            android.view.Display target=manager.getDefaultDisplay();
            // Pixel size of the current display; restart after changing orientation.
            android.graphics.Point size=new android.graphics.Point();
            target.getRealSize(size);
            imageReader=ImageReader.newInstance(size.x,size.y,PixelFormat.RGBA_8888,3);
            display=projection.createVirtualDisplay("ReadingSubtitleCapture",size.x,size.y,
                metrics.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),null,ui);
            if(display==null)throw new IllegalStateException("画面の複製を開始できません");
            setStatus("Kindleを開いて「読取」を押してください");
        }catch(Exception e){
            setStatus("起動エラー: "+e.getMessage());
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void startForegroundProjection(){
        NotificationManager nm=getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"読書字幕の画面共有",NotificationManager.IMPORTANCE_LOW));
        Intent stopIntent=new Intent(this,OverlayService.class).setAction(STOP);
        PendingIntent stop=PendingIntent.getService(this,0,stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(this,CHANNEL)
            .setContentTitle("読書字幕 — 画面共有中")
            .setContentText("読取ボタンを押した時だけOCRを実行します")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"終了",stop).build())
            .build();
        if(Build.VERSION.SDK_INT>=29)
            startForeground(NOTICE,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(NOTICE,n);
    }

    private void createPanel(){
        wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        window=new LinearLayout(this);
        window.setOrientation(LinearLayout.VERTICAL);
        window.setPadding(dp(12),dp(9),dp(12),dp(9));
        window.setBackground(roundRect(Color.rgb(239,247,242),0,0));
        LinearLayout top=new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        window.addView(top,new LinearLayout.LayoutParams(-1,-2));
        TextView title=new TextView(this);
        title.setText("読書字幕  EN → JA");title.setTextSize(14);title.setTextColor(Color.rgb(23,66,57));
        title.setTypeface(null,1);
        top.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        topButton(top,"読取",()->capture());
        foldButton=topButton(top,"縮小",()->toggleFold());
        topButton(top,"終了",()->stopSelf());

        status=new TextView(this);
        status.setTextSize(12);status.setTextColor(Color.rgb(35,97,70));
        status.setPadding(0,dp(5),0,dp(5));
        window.addView(status);

        ScrollView scroller=new ScrollView(this);
        scroller.setFillViewport(false);
        LinearLayout body=new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        scroller.addView(body);
        window.addView(scroller,new LinearLayout.LayoutParams(-1,0,1));
        lines=new LinearLayout(this);lines.setOrientation(LinearLayout.VERTICAL);
        body.addView(lines);
        TextView wordTitle=addLabel(body,"単語の意味 / VOCABULARY（機械翻訳）",12,Color.rgb(85,61,120),true);
        wordTitle.setPadding(0,dp(7),0,dp(3));
        words=new LinearLayout(this);words.setOrientation(LinearLayout.VERTICAL);
        body.addView(words);
        addLabel(lines,"読書画面へ移動したら「読取」を押してください。字幕が下部に表示されます。",14,Color.DKGRAY,false);

        params=new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,dp(312),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.BOTTOM;
        wm.addView(window,params);
    }

    private Button topButton(LinearLayout parent,String text,Runnable action){
        Button b=new Button(this);
        b.setText(text);b.setAllCaps(false);b.setTextSize(11);
        b.setPadding(0,0,0,0);b.setMinWidth(0);b.setMinimumWidth(0);
        parent.addView(b,new LinearLayout.LayoutParams(dp(text.length()>2?58:50),dp(43)));
        b.setOnClickListener(v->action.run());
        return b;
    }
    private TextView addLabel(LinearLayout parent,String text,int sp,int color,boolean bold){
        TextView v=new TextView(this);v.setText(text);v.setTextSize(sp);v.setTextColor(color);
        if(bold)v.setTypeface(null,1);
        v.setPadding(0,dp(4),0,dp(3));parent.addView(v);
        return v;
    }
    private void setStatus(String text){if(status!=null)status.setText(text);}
    private void toggleFold(){
        folded=!folded;
        params.height=dp(folded?57:312);
        foldButton.setText(folded?"展開":"縮小");
        if(wm!=null&&window!=null)wm.updateViewLayout(window,params);
    }
    private void capture(){
        if(busy||projection==null||imageReader==null)return;
        busy=true;
        if(folded)toggleFold();
        setStatus("字幕パネルを隠して画面を読み取ります…");
        // Never OCR our own overlay. Allow the next screen frame to be rendered.
        window.setVisibility(View.INVISIBLE);
        ui.postDelayed(()->takeFrame(0),750);
    }
    private void takeFrame(int tries){
        if(imageReader==null||window==null){busy=false;return;}
        Image image=null;
        try{
            image=imageReader.acquireLatestImage();
            if(image==null){
                if(tries<5){ui.postDelayed(()->takeFrame(tries+1),200);return;}
                window.setVisibility(View.VISIBLE);
                setStatus("画像を取得できません。画面全体の共有設定を確認してください。");
                busy=false;return;
            }
            Image.Plane p=image.getPlanes()[0];
            ByteBuffer buffer=p.getBuffer();
            int width=image.getWidth(),height=image.getHeight();
            int padding=p.getRowStride()-p.getPixelStride()*width;
            int padded=width+padding/p.getPixelStride();
            Bitmap raw=Bitmap.createBitmap(padded,height,Bitmap.Config.ARGB_8888);
            buffer.rewind();raw.copyPixelsFromBuffer(buffer);
            Bitmap crop=Bitmap.createBitmap(raw,0,0,width,height);
            raw.recycle();
            window.setVisibility(View.VISIBLE);
            setStatus("OCR解析中…");
            lines.removeAllViews();words.removeAllViews();
            engine.readImage(crop,new ReadingEngine.Listener(){
                public void onStatus(String s){setStatus(s);}
                public void onSource(String source){
                    // Show only individual clauses below, not the entire page twice.
                }
                public void onSentence(String en,String ja){
                    addLabel(lines,en,13,Color.rgb(69,75,73),true);
                    TextView jp=addLabel(lines,ja,16,Color.rgb(21,77,62),true);
                    jp.setBackground(roundRect(Color.rgb(222,239,231),dp(6),0));
                    jp.setPadding(dp(9),dp(7),dp(9),dp(8));
                }
                public void onWord(String en,String ja){
                    TextView entry=addLabel(words,en+"  →  "+ja,13,Color.rgb(85,61,120),true);
                    entry.setBackground(roundRect(Color.rgb(237,230,246),dp(7),dp(1)));
                    entry.setPadding(dp(10),dp(6),dp(10),dp(6));
                }
                public void onError(String s){setStatus(s);busy=false;}
                public void onDone(){busy=false;}
            });
        }catch(Exception e){
            window.setVisibility(View.VISIBLE);
            setStatus("読取エラー: "+e.getMessage());
            busy=false;
        }finally{if(image!=null)image.close();}
    }
    private GradientDrawable roundRect(int color,int radius,int stroke){
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(color);bg.setCornerRadius(radius);
        if(stroke>0)bg.setStroke(stroke,Color.rgb(183,168,203));
        return bg;
    }
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    @Override public void onDestroy(){
        if(stopping){super.onDestroy();return;}
        stopping=true;
        ui.removeCallbacksAndMessages(null);
        if(engine!=null){engine.close();engine=null;}
        if(projection!=null){
            try{if(projectionCallback!=null)projection.unregisterCallback(projectionCallback);}catch(Exception ignored){}
        }
        if(display!=null){display.release();display=null;}
        if(imageReader!=null){imageReader.close();imageReader=null;}
        if(projection!=null){projection.stop();projection=null;}
        if(wm!=null&&window!=null){
            try{wm.removeView(window);}catch(Exception ignored){}
            window=null;
        }
        super.onDestroy();
    }
}
