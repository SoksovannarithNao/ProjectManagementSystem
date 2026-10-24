package backend.repository;

import backend.entity.UserIdentity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    // The account behind a Google sign-in; the user and role are loaded with it because the caller
    // starts a session from them outside the transaction.
    @EntityGraph(attributePaths = {"user", "user.role"})
    Optional<UserIdentity> findByProviderAndSubject(String provider, String subject);

    Optional<UserIdentity> findByUserIdAndProvider(Long userId, String provider);
}
