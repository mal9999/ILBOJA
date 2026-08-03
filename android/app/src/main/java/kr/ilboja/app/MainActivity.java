package kr.ilboja.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 전용 플러그인은 super.onCreate **전에** 등록해야 브리지가 잡아 간다
        registerPlugin(OrientationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
