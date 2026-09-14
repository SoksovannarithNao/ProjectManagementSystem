package backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

// Deliberately narrower than UserUpdateRequest: no roleId/accountStatus (a
// user can't promote or (de)activate themselves) and no username (renaming
// yourself would outlive the JWT already issued for the old username, since
// the token's "sub" claim doesn't change until the next login). Also no
// password — changing a password now goes through ChangePasswordRequest,
// which requires the current password rather than accepting a bare
// replacement from anyone holding a still-valid JWT. Also no position/
// department — those are Team-Admin-managed only, via
// UserService.updateMemberPositionDepartment (see backend/README.md). Also
// no profilePhotoUrl — that's upload-only now, via
// UserService.uploadOwnProfilePhoto/deleteOwnProfilePhoto.
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

}
