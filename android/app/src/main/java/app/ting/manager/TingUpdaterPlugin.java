package app.ting.manager;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * APK_Installer — Capacitor plugin native cho luồng tự cập nhật Android.
 *
 * Cung cấp 4 phương thức:
 *  - downloadApk: tải APK qua HTTPS (chỉ origin cho phép), phát tiến độ về JS,
 *    xác minh SHA-256 + kích thước trước khi mời cài đặt.
 *  - installApk: khởi chạy intent cài đặt qua FileProvider với FLAG_GRANT_READ_URI_PERMISSION.
 *  - ensureInstallPermission: mở màn hình "cài ứng dụng không rõ nguồn gốc" nếu thiếu quyền.
 *  - cleanupApk: xoá APK đã tải.
 */
@CapacitorPlugin(name = "TingUpdater")
public class TingUpdaterPlugin extends Plugin {

    // Tên file APK cố định trong thư mục tải để dễ dọn dẹp.
    private static final String APK_FILE_NAME = "ting-update.apk";

    // Buffer tải 16KB.
    private static final int BUFFER_SIZE = 16 * 1024;

    // Allowlist host cho origin phát hành tin cậy của GitHub (khớp isAllowedReleaseUrl phía JS).
    private static final List<String> ALLOWED_HOSTS = Arrays.asList(
        "raw.githubusercontent.com",
        "github.com",
        "codeload.github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com"
    );

    /**
     * downloadApk({ url, expectedSha256, expectedSize }) -> { filePath }
     * Tải APK về thư mục files của app, phát tiến độ, và xác minh toàn vẹn.
     * Nếu xác minh thất bại: xoá file và reject (KHÔNG khởi chạy installer).
     */
    @PluginMethod
    public void downloadApk(final PluginCall call) {
        final String url = call.getString("url");
        final String expectedSha256 = call.getString("expectedSha256");
        final Long expectedSizeValue = call.getLong("expectedSize");

        if (url == null || url.isEmpty()) {
            call.reject("Thiếu URL tải bản cập nhật.");
            return;
        }
        if (!isAllowedReleaseUrl(url)) {
            call.reject("URL bản cập nhật không thuộc nguồn phát hành tin cậy.");
            return;
        }
        if (expectedSha256 == null || expectedSha256.isEmpty()) {
            call.reject("Thiếu mã băm SHA-256 để xác minh bản cập nhật.");
            return;
        }
        if (expectedSizeValue == null) {
            call.reject("Thiếu kích thước file để xác minh bản cập nhật.");
            return;
        }

        final long expectedSize = expectedSizeValue;

        // Tải trên luồng nền để không chặn UI.
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection connection = null;
                File apkFile = new File(getDownloadDir(), APK_FILE_NAME);
                InputStream input = null;
                OutputStream output = null;
                try {
                    URL parsed = new URL(url);
                    connection = (HttpURLConnection) parsed.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setConnectTimeout(30000);
                    connection.setReadTimeout(30000);
                    connection.connect();

                    int statusCode = connection.getResponseCode();
                    if (statusCode < 200 || statusCode >= 300) {
                        call.reject("Nguồn phát hành trả về lỗi khi tải bản cập nhật.");
                        return;
                    }

                    // getContentLength() trả int, đủ cho kích thước APK và tương thích minSdk 23.
                    long totalBytes = connection.getContentLength();
                    if (totalBytes <= 0) {
                        totalBytes = expectedSize;
                    }

                    MessageDigest digest = MessageDigest.getInstance("SHA-256");
                    input = connection.getInputStream();
                    output = new FileOutputStream(apkFile);

                    byte[] buffer = new byte[BUFFER_SIZE];
                    long transferred = 0;
                    int read;
                    int lastPercent = -1;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        transferred += read;

                        if (totalBytes > 0) {
                            int percent = (int) ((transferred * 100L) / totalBytes);
                            if (percent > 100) {
                                percent = 100;
                            }
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                emitProgress(percent, transferred, totalBytes);
                            }
                        }
                    }
                    output.flush();
                    output.close();
                    output = null;

                    // Xác minh kích thước + SHA-256 trước khi cho phép cài đặt.
                    long actualSize = apkFile.length();
                    String actualSha256 = toHex(digest.digest());

                    boolean sizeMatches = actualSize == expectedSize;
                    boolean shaMatches = actualSha256.equalsIgnoreCase(expectedSha256);

                    if (!sizeMatches || !shaMatches) {
                        // Toàn vẹn thất bại: xoá file, KHÔNG khởi chạy installer.
                        deleteQuietly(apkFile);
                        call.reject("Bản tải không qua kiểm tra toàn vẹn. Đã xoá file tải về.");
                        return;
                    }

                    JSObject result = new JSObject();
                    result.put("filePath", apkFile.getAbsolutePath());
                    result.put("size", actualSize);
                    result.put("sha256", actualSha256);
                    call.resolve(result);
                } catch (Exception error) {
                    deleteQuietly(apkFile);
                    call.reject("Tải bản cập nhật thất bại.", error);
                } finally {
                    closeQuietly(input);
                    closeQuietly(output);
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            }
        }).start();
    }

    /**
     * installApk({ filePath }) -> { launched }
     * Khởi chạy intent cài đặt gói của Android cho APK đã tải qua FileProvider,
     * cấp FLAG_GRANT_READ_URI_PERMISSION trên URI.
     */
    @PluginMethod
    public void installApk(final PluginCall call) {
        final String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("Thiếu đường dẫn file APK để cài đặt.");
            return;
        }

        final File apkFile = new File(filePath);
        if (!apkFile.exists()) {
            call.reject("Không tìm thấy file APK để cài đặt.");
            return;
        }

        try {
            String authority = getContext().getPackageName() + ".fileprovider";
            final Uri apkUri = FileProvider.getUriForFile(getContext(), authority, apkFile);

            final Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        getActivity().startActivity(intent);
                        JSObject result = new JSObject();
                        result.put("launched", true);
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Không thể khởi chạy trình cài đặt.", error);
                    }
                }
            });
        } catch (Exception error) {
            call.reject("Không thể chuẩn bị cài đặt bản cập nhật.", error);
        }
    }

    /**
     * ensureInstallPermission() -> { granted }
     * Nếu canRequestPackageInstalls() = false → mở màn hình
     * Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES cho package của app.
     */
    @PluginMethod
    public void ensureInstallPermission(final PluginCall call) {
        try {
            boolean granted = canInstallPackages();
            if (granted) {
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                final Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            getActivity().startActivity(intent);
                            JSObject result = new JSObject();
                            result.put("granted", false);
                            result.put("opened", true);
                            call.resolve(result);
                        } catch (Exception error) {
                            call.reject("Không thể mở màn hình cấp quyền cài đặt.", error);
                        }
                    }
                });
            } else {
                // Dưới API 26 không cần quyền riêng cho cài ngoài.
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
            }
        } catch (Exception error) {
            call.reject("Không thể kiểm tra quyền cài đặt.", error);
        }
    }

    /**
     * cleanupApk({ filePath? }) -> { deleted }
     * Xoá APK đã tải. Nếu không truyền filePath thì xoá file mặc định.
     */
    @PluginMethod
    public void cleanupApk(final PluginCall call) {
        try {
            String filePath = call.getString("filePath");
            File apkFile;
            if (filePath != null && !filePath.isEmpty()) {
                apkFile = new File(filePath);
            } else {
                apkFile = new File(getDownloadDir(), APK_FILE_NAME);
            }

            boolean deleted = false;
            if (apkFile.exists()) {
                deleted = apkFile.delete();
            }

            JSObject result = new JSObject();
            result.put("deleted", deleted);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Không thể xoá file bản cập nhật.", error);
        }
    }

    // ------- Helper riêng tư -------

    private void emitProgress(int percent, long transferred, long total) {
        JSObject progress = new JSObject();
        progress.put("percent", percent);
        progress.put("transferred", transferred);
        progress.put("total", total);
        notifyListeners("downloadProgress", progress);
    }

    private File getDownloadDir() {
        File dir = getContext().getExternalFilesDir(null);
        if (dir == null) {
            // Fallback vào bộ nhớ trong nếu external không khả dụng.
            dir = getContext().getFilesDir();
        }
        return dir;
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private boolean isAllowedReleaseUrl(String url) {
        try {
            URL parsed = new URL(url);
            String scheme = parsed.getProtocol();
            String host = parsed.getHost();
            if (scheme == null || host == null) {
                return false;
            }
            if (!scheme.equalsIgnoreCase("https")) {
                return false;
            }
            String lowerHost = host.toLowerCase(Locale.ROOT);
            for (String allowed : ALLOWED_HOSTS) {
                if (lowerHost.equals(allowed)) {
                    return true;
                }
            }
            // Cho phép mọi subdomain của githubusercontent.com (miền tải asset GitHub).
            return lowerHost.endsWith(".githubusercontent.com");
        } catch (Exception error) {
            return false;
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            builder.append(String.format("%02x", b));
        }
        return builder.toString();
    }

    private static void deleteQuietly(File file) {
        try {
            if (file != null && file.exists()) {
                file.delete();
            }
        } catch (Exception ignored) {
            // Bỏ qua lỗi xoá.
        }
    }

    private static void closeQuietly(java.io.Closeable closeable) {
        try {
            if (closeable != null) {
                closeable.close();
            }
        } catch (Exception ignored) {
            // Bỏ qua lỗi đóng stream.
        }
    }
}
