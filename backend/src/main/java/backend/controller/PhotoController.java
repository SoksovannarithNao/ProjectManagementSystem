package backend.controller;

import backend.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Public (see SecurityConfig) — an <img> tag can't attach the JWT this API
// otherwise requires everywhere else. Keyed by an unguessable per-upload
// token (see User.profilePhotoToken), not a user id, so photos aren't
// enumerable and a re-upload is automatically a fresh, uncached URL.
@RestController
@RequestMapping("/api/photos")
public class PhotoController {

    private final UserService userService;

    public PhotoController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable String token) {
        UserService.ProfilePhoto photo = userService.getProfilePhotoByToken(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .body(photo.bytes());
    }
}
