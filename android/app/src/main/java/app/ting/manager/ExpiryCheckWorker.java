package app.ting.manager;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QuerySnapshot;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.text.SimpleDateFormat;
import java.util.concurrent.TimeUnit;

public class ExpiryCheckWorker extends Worker {
    private static final String CHANNEL_ID = "ting-expiry-alerts";
    private static final String PREFS_NAME = "ting_expiry_worker";
    private static final String LAST_BUCKET_KEY = "last_notified_bucket";
    private static final int NOTIFICATION_ID = 54001;

    public ExpiryCheckWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            if (user == null) return Result.success();

            FirebaseFirestore db = FirebaseFirestore.getInstance();
            DocumentSnapshot settingsDoc = Tasks.await(
                    db.collection("users").document(user.getUid())
                            .collection("settings").document("general").get(),
                    30,
                    TimeUnit.SECONDS
            );

            NotificationSettings settings = NotificationSettings.from(settingsDoc);
            if (!settings.enabled || !settings.nativeEnabled) return Result.success();

            QuerySnapshot snapshot = Tasks.await(
                    db.collection("users").document(user.getUid()).collection("accounts").get(),
                    30,
                    TimeUnit.SECONDS
            );

            List<ExpiryItem> items = collectExpiryItems(snapshot, settings);
            if (items.isEmpty()) return Result.success();

            long bucket = System.currentTimeMillis() / Math.max(1L, settings.repeatHours * 60L * 60L * 1000L);
            String bucketKey = bucket + ":" + buildItemKey(items);
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (bucketKey.equals(prefs.getString(LAST_BUCKET_KEY, ""))) return Result.success();

            boolean sent = sendNotification(items);
            if (sent) prefs.edit().putString(LAST_BUCKET_KEY, bucketKey).apply();
            return Result.success();
        } catch (Exception error) {
            return Result.retry();
        }
    }

    private List<ExpiryItem> collectExpiryItems(QuerySnapshot snapshot, NotificationSettings settings) {
        List<ExpiryItem> items = new ArrayList<>();
        long today = startOfTodayMillis();
        for (DocumentSnapshot doc : snapshot.getDocuments()) {
            if (Boolean.TRUE.equals(doc.getBoolean("isDeleted"))) continue;
            if ("lifetime".equals(doc.getString("expiryType"))) continue;

            Long expiryDate = readExpiryDateMillis(doc.get("expiryDate"));
            if (expiryDate == null) continue;

            int daysLeft = (int) ((expiryDate - today) / TimeUnit.DAYS.toMillis(1));
            if (!shouldNotify(doc, settings, daysLeft)) continue;

            String name = doc.getString("name");
            if (name == null || name.trim().isEmpty()) name = "Tai khoan";
            items.add(new ExpiryItem(doc.getId(), name, daysLeft));
        }
        Collections.sort(items, (a, b) -> Integer.compare(a.daysLeft, b.daysLeft));
        return items;
    }

    private boolean shouldNotify(DocumentSnapshot doc, NotificationSettings settings, int daysLeft) {
        if (daysLeft < 0) {
            return settings.overdueDays > 0 && Math.abs(daysLeft) <= settings.overdueDays;
        }

        List<Integer> accountDays = readIntegerList(doc.get("notifyDaysBefore"));
        List<Integer> notifyDays = accountDays.isEmpty() ? settings.daysBefore : accountDays;
        int notifyWindow = 0;
        for (Integer day : notifyDays) {
            if (day != null && day > notifyWindow) notifyWindow = day;
        }
        return daysLeft <= notifyWindow;
    }

    private Long readExpiryDateMillis(Object value) {
        try {
            if (value instanceof String) {
                SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                format.setLenient(false);
                Date parsed = format.parse((String) value);
                return parsed == null ? null : startOfDayMillis(parsed);
            }
            if (value instanceof Timestamp) {
                return startOfDayMillis(((Timestamp) value).toDate());
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private long startOfTodayMillis() {
        return startOfDayMillis(new Date());
    }

    private long startOfDayMillis(Date date) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar.getTimeInMillis();
    }

    private boolean sendNotification(List<ExpiryItem> items) {
        Context context = getApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }

        ensureChannel(context);

        String title = items.size() == 1
                ? "Ting! nhac han tai khoan"
                : String.format(Locale.US, "Ting! %d tai khoan can chu y", items.size());
        String body = buildNotificationBody(items);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(items.get(0).summary())
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true);

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        return true;
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Nhac han tai khoan",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Thong bao tai khoan sap hoac da het han trong Ting!");
        manager.createNotificationChannel(channel);
    }

    private String buildNotificationBody(List<ExpiryItem> items) {
        StringBuilder builder = new StringBuilder();
        for (ExpiryItem item : items) {
            if (builder.length() > 0) builder.append('\n');
            builder.append("- ").append(item.summary());
        }
        return builder.toString();
    }

    private String buildItemKey(List<ExpiryItem> items) {
        StringBuilder builder = new StringBuilder();
        for (ExpiryItem item : items) {
            if (builder.length() > 0) builder.append(",");
            builder.append(item.id).append(":").append(item.daysLeft);
        }
        return builder.toString();
    }

    private static List<Integer> readIntegerList(Object value) {
        List<Integer> result = new ArrayList<>();
        if (value instanceof List<?>) {
            for (Object item : (List<?>) value) {
                if (item instanceof Number) result.add(((Number) item).intValue());
                else if (item instanceof String) {
                    try {
                        result.add(Integer.parseInt((String) item));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        return result;
    }

    private static final class NotificationSettings {
        final boolean enabled;
        final boolean nativeEnabled;
        final List<Integer> daysBefore;
        final int repeatHours;
        final int overdueDays;

        private NotificationSettings(boolean enabled, boolean nativeEnabled, List<Integer> daysBefore, int repeatHours, int overdueDays) {
            this.enabled = enabled;
            this.nativeEnabled = nativeEnabled;
            this.daysBefore = daysBefore;
            this.repeatHours = repeatHours;
            this.overdueDays = overdueDays;
        }

        static NotificationSettings from(DocumentSnapshot doc) {
            Object notificationSettings = doc == null ? null : doc.get("notificationSettings");
            boolean enabled = readBoolean(doc, notificationSettings, "enabled", "notificationsEnabled", true);
            boolean nativeEnabled = readBoolean(doc, notificationSettings, "nativeEnabled", "nativeNotificationsEnabled", true);
            List<Integer> daysBefore = readDays(doc, notificationSettings);
            int repeatHours = Math.max(1, readInt(doc, notificationSettings, "repeatHours", "notifyRepeatHours", 24));
            int overdueDays = Math.max(0, readInt(doc, notificationSettings, "overdueDays", "notifyOverdueDays", 30));
            return new NotificationSettings(enabled, nativeEnabled, daysBefore, repeatHours, overdueDays);
        }

        private static boolean readBoolean(DocumentSnapshot doc, Object nested, String nestedKey, String rootKey, boolean fallback) {
            Object value = readNested(nested, nestedKey);
            if (value == null && doc != null) value = doc.get(rootKey);
            return value instanceof Boolean ? (Boolean) value : fallback;
        }

        private static int readInt(DocumentSnapshot doc, Object nested, String nestedKey, String rootKey, int fallback) {
            Object value = readNested(nested, nestedKey);
            if (value == null && doc != null) value = doc.get(rootKey);
            if (value instanceof Number) return ((Number) value).intValue();
            if (value instanceof String) {
                try {
                    return Integer.parseInt((String) value);
                } catch (NumberFormatException ignored) {
                }
            }
            return fallback;
        }

        private static List<Integer> readDays(DocumentSnapshot doc, Object nested) {
            List<Integer> days = readIntegerList(readNested(nested, "daysBefore"));
            if (days.isEmpty() && doc != null) days = readIntegerList(doc.get("defaultNotifyDays"));
            if (days.isEmpty()) {
                days.add(5);
                days.add(3);
                days.add(1);
            }
            Set<Integer> seen = new HashSet<>();
            List<Integer> normalized = new ArrayList<>();
            for (Integer day : days) {
                if (day != null && day >= 0 && day <= 365 && seen.add(day)) normalized.add(day);
            }
            if (normalized.isEmpty()) {
                normalized.add(5);
                normalized.add(3);
                normalized.add(1);
            }
            return normalized;
        }

        private static Object readNested(Object nested, String key) {
            if (nested instanceof java.util.Map<?, ?>) return ((java.util.Map<?, ?>) nested).get(key);
            return null;
        }
    }

    private static final class ExpiryItem {
        final String id;
        final String name;
        final int daysLeft;

        ExpiryItem(String id, String name, int daysLeft) {
            this.id = id;
            this.name = name;
            this.daysLeft = daysLeft;
        }

        String summary() {
            if (daysLeft < 0) return name + " qua han " + Math.abs(daysLeft) + " ngay";
            if (daysLeft == 0) return name + " het han hom nay";
            return name + " con " + daysLeft + " ngay";
        }
    }
}
