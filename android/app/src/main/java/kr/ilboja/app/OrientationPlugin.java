package kr.ilboja.app;

import android.content.pm.ActivityInfo;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 화면 방향 — **앱은 세로 고정, 촬영 화면만 예외.**
 *
 * <p>앱 화면(메인·입력·목록…)은 세로로만 쓴다(사용자 확인, 2026-08-03). 그래서
 * `AndroidManifest.xml` 의 MainActivity 에 `screenOrientation="portrait"` 를 박았다.
 * 그런데 <b>사진은 눕혀 찍는다.</b> 세로로 잠긴 채 촬영하면 눕혀 들어도 늘 세로 사진이 나온다 —
 * 촬영 회전은 액티비티의 표시 방향을 따라가기 때문이다.
 *
 * <p>그래서 촬영 화면에 들어갈 때만 <b>센서를 따르게</b> 하고 나올 때 세로로 되돌린다.
 * `SCREEN_ORIENTATION_SENSOR` 는 <b>시스템의 «자동회전 끄기»까지 덮어쓴다</b> — 기본 카메라 앱이
 * 자동회전을 꺼 놔도 도는 것과 같은 방식이다. 이게 필요한 이유는 실기기에서 확인됐다:
 * 자동회전이 꺼져 있으면 폰을 돌려도 액티비티가 안 돌고, 따라서 가로 촬영이 아예 안 된다.
 *
 * <p>플러그인 하나를 새로 만든 이유: `camera-preview` 는 `lockAndroidOrientation:true` 일 때
 * LOCKED 를 걸 뿐, «센서를 따르라»고 요청하는 길은 열어 두지 않았다.
 */
@CapacitorPlugin(name = "Orientation")
public class OrientationPlugin extends Plugin {

    /** 촬영 화면 진입 — 폰을 돌리는 대로 따라간다 (자동회전 설정과 무관하게) */
    @PluginMethod
    public void followSensor(PluginCall call) {
        setOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        call.resolve();
    }

    /** 촬영 화면 이탈 — 앱 기본값인 세로로 되돌린다 */
    @PluginMethod
    public void lockPortrait(PluginCall call) {
        setOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        call.resolve();
    }

    private void setOrientation(final int mode) {
        // setRequestedOrientation 은 UI 스레드에서만 안전하다
        getActivity().runOnUiThread(() -> getActivity().setRequestedOrientation(mode));
    }
}
