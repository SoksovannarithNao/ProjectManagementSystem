package backend.dto;

import backend.entity.User;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public class UserResponse {

    private Long id;
    private String fullName;
    private String username;
    private String email;
    private String gender;
    private LocalDate dateOfBirth;
    private String phoneNumber;
    private String profilePhotoUrl;
    private Long positionId;
    private String positionName;
    private Long departmentId;
    private String departmentName;
    private String role;
    private String roleDescription;
    private String accountStatus;
    private String themePreference;
    private boolean taskNotificationsEnabled;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public UserResponse(User user) {
        this.id = user.getId();
        this.fullName = user.getFullName();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.gender = user.getGender();
        this.dateOfBirth = user.getDateOfBirth();
        this.phoneNumber = user.getPhoneNumber();
        this.profilePhotoUrl = user.getProfilePhotoUrl();
        this.positionId = user.getPosition() != null ? user.getPosition().getId() : null;
        this.positionName = user.getPosition() != null ? user.getPosition().getName() : null;
        this.departmentId = user.getDepartment() != null ? user.getDepartment().getId() : null;
        this.departmentName = user.getDepartment() != null ? user.getDepartment().getName() : null;
        this.role = user.getRole().getName();
        this.roleDescription = user.getRole().getDescription();
        this.accountStatus = user.getAccountStatus();
        this.themePreference = user.getThemePreference();
        this.taskNotificationsEnabled = user.isTaskNotificationsEnabled();
        this.createdAt = user.getCreatedAt();
        this.updatedAt = user.getUpdatedAt();
    }

    public Long getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getGender() {
        return gender;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getProfilePhotoUrl() {
        return profilePhotoUrl;
    }

    public Long getPositionId() {
        return positionId;
    }

    public String getPositionName() {
        return positionName;
    }

    public Long getDepartmentId() {
        return departmentId;
    }

    public String getDepartmentName() {
        return departmentName;
    }

    public String getRole() {
        return role;
    }

    public String getRoleDescription() {
        return roleDescription;
    }

    public String getAccountStatus() {
        return accountStatus;
    }

    public String getThemePreference() {
        return themePreference;
    }

    public boolean isTaskNotificationsEnabled() {
        return taskNotificationsEnabled;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}