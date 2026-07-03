package app.ting.manager;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TingNotifications")
public class TingNotificationsPlugin extends Plugin {
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Cannot open notification settings", error);
        }
    }

    @PluginMethod
    public void startBackgroundCheck(PluginCall call) {
        try {
            ExpiryCheckScheduler.schedule(getContext());
            JSObject result = new JSObject();
            result.put("scheduled", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Cannot start background notification check", error);
        }
    }

    @PluginMethod
    public void stopBackgroundCheck(PluginCall call) {
        try {
            ExpiryCheckScheduler.cancel(getContext());
            JSObject result = new JSObject();
            result.put("cancelled", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Cannot stop background notification check", error);
        }
    }
}
