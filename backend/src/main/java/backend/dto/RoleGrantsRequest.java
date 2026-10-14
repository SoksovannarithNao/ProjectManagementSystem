package backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

// The complete set of grants a role should have after the edit. The role's
// existing grants are replaced by this list in one transaction.
public class RoleGrantsRequest {

    @NotNull
    @Valid
    private List<GrantItem> grants;

    public List<GrantItem> getGrants() {
        return grants;
    }

    public void setGrants(List<GrantItem> grants) {
        this.grants = grants;
    }

    public static class GrantItem {

        @NotBlank
        private String scope;

        @NotBlank
        private String resource;

        @NotBlank
        private String permission;

        public String getScope() {
            return scope;
        }

        public void setScope(String scope) {
            this.scope = scope;
        }

        public String getResource() {
            return resource;
        }

        public void setResource(String resource) {
            this.resource = resource;
        }

        public String getPermission() {
            return permission;
        }

        public void setPermission(String permission) {
            this.permission = permission;
        }
    }
}
