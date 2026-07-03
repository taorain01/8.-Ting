package app.ting.manager;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BACK_BUTTON_SCRIPT =
        "(function(){try{if(typeof window.handleTingAndroidBackButton==='function')" +
        "{return window.handleTingAndroidBackButton();}return 'handled';}" +
        "catch(error){console.error('Ting back button error:', error);return 'handled';}})();";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TingNotificationsPlugin.class);
        registerPlugin(TingUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleAndroidBackButton();
            }
        });
        ExpiryCheckScheduler.schedule(this);
    }

    private void handleAndroidBackButton() {
        if (bridge == null || bridge.getWebView() == null) {
            finish();
            return;
        }

        bridge.eval(BACK_BUTTON_SCRIPT, result -> {
            if (result != null && result.contains("exit")) {
                runOnUiThread(this::finish);
            }
        });
    }
}
