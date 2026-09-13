package backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

// Application/appearance preferences — deliberately separate from
// SelfProfileUpdateRequest (personal info) so Settings and Profile hit
// different endpoints, matching the app's Settings-vs-Profile UI split.
public class UserPreferencesRequest {

    @NotNull
    @Pattern(regexp = "LIGHT|DARK|SYSTEM")
    private String themePreference;

    @NotNull
    private Boolean taskNotificationsEnabled;

    public String getThemePreference() {
        return themePreference;
    }

    public void setThemePreference(String themePreference) {
        this.themePreference = themePreference;
    }

    public Boolean getTaskNotificationsEnabled() {
        return taskNotificationsEnabled;
    }

    public void setTaskNotificationsEnabled(Boolean taskNotificationsEnabled) {
        this.taskNotificationsEnabled = taskNotificationsEnabled;
    }
}
