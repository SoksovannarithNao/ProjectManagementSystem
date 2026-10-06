package backend.dto;

import backend.entity.User;

// Deliberately narrower than UserResponse: the invite picker can search the
// whole org, so it only exposes what's needed to recognise a person (no
// email, phone, date of birth, etc.).
public record InvitableUserResponse(
        Long id,
        String fullName,
        String username,
        String positionName,
        String profilePhotoUrl
) {

    public InvitableUserResponse(User user) {
        this(
                user.getId(),
                user.getFullName(),
                user.getUsername(),
                user.getPosition() != null ? user.getPosition().getName() : null,
                user.getProfilePhotoToken() != null ? "/api/photos/" + user.getProfilePhotoToken() : null
        );
    }
}
