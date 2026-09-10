package backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

// Deliberately narrower than UserUpdateRequest: no roleId/accountStatus (a
// user can't promote or (de)activate themselves) and no username (renaming
// yourself would outlive the JWT already issued for the old username, since
// the token's "sub" claim doesn't change until the next login).
public class SelfProfileUpdateRequest {

    @NotBlank
    @Size(max = 150)
    private String fullName;

    @NotBlank
    @Email
    @Size(max = 255)
    private String email;

    @Size(max = 20)
    private String gender;

    private LocalDate dateOfBirth;

    @Size(max = 30)
    private String phoneNumber;

    @Size(max = 500)
    private String profilePhotoUrl;

    @Size(max = 100)
    private String position;

    @Size(max = 100)
    private String department;

    // Optional — null/blank leaves the existing password hash untouched.
    @Size(min = 8, max = 255)
    private String password;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getProfilePhotoUrl() {
        return profilePhotoUrl;
    }

    public void setProfilePhotoUrl(String profilePhotoUrl) {
        this.profilePhotoUrl = profilePhotoUrl;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
