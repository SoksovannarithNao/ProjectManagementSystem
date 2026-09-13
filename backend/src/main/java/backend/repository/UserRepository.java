package backend.repository;

import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u JOIN FETCH u.role WHERE u.username = :username")
    Optional<User> findByUsername(String username);

    @Query("SELECT u FROM User u JOIN FETCH u.role")
    List<User> findAllWithRoles();

    Optional<User> findByEmail(String email);

    // Case-insensitive, matching idx_users_username_lower/idx_users_email_lower
    // — used for friendly pre-checks during registration (the DB unique
    // index enforces the same rule regardless, but with a less readable
    // error message if this check is skipped).
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);
}