package app.ting.manager;

import android.content.Context;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public final class ExpiryCheckScheduler {
    public static final String WORK_NAME = "ting_expiry_check";
    private static final long CHECK_INTERVAL_HOURS = 6L;

    private ExpiryCheckScheduler() {}

    public static void schedule(Context context) {
        Context appContext = context.getApplicationContext();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                ExpiryCheckWorker.class,
                CHECK_INTERVAL_HOURS,
                TimeUnit.HOURS
        ).build();

        WorkManager.getInstance(appContext).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
        );
    }

    public static void cancel(Context context) {
        WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(WORK_NAME);
    }
}
