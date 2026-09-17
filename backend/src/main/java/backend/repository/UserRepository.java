package backend.repository;

import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, Long> {

    // LEFT JOIN FETCH — not a plain (inner) JOIN FETCH — because role is now
    // optional (see User.role): an ordinary user has no Role row at all, and
    // an inner join would silently exclude every such user from the result
    // entirely (this actually happened during development — role_id used to
    // be NOT NULL for everyone, so the difference was invisible until it
    // wasn't). Still eager rather than lazy, same as before, to avoid N+1
    // queries wherever the caller then reads user.getRole().
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role WHERE u.username = :username")
    Optional<User> findByUsername(String username);

    // Case-insensitive lookup for the team-invitation "search by username"
    // flow — usernames are unique case-insensitively (idx_users_username_lower)
    // but stored with their original casing.
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role WHERE LOWER(u.username) = LOWER(:username)")
    Optional<User> findByUsernameIgnoreCase(String username);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role")
    List<User> findAllWithRoles();

    Optional<User> findByEmail(String email);

    // Case-insensitive, matching idx_users_username_lower/idx_users_email_lower
    // — used for friendly pre-checks during registration (the DB unique
    // index enforces the same rule regardless, but with a less readable
    // error message if this check is skipped).
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    // Public photo lookup (see PhotoController) — keyed by the random token
    // rather than user id, so photos aren't enumerable by walking ids.
    Optional<User> findByProfilePhotoToken(UUID profilePhotoToken);
}