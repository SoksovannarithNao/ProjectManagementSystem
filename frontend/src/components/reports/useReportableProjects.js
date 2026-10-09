import { useAuth } from '../../auth/AuthContext'
import { useApi } from '../../api/useApi'
import { getProjects } from '../../api/projects'

// The projects the signed-in user may report on (server rule: GENERATE_REPORTS in the
// project, or through the Project Manager role) - the picker offers only those.
export function useReportableProjects() {
  const { can, isAdministrator } = useAuth()
  const { data } = useApi(getProjects)
  return (data ?? []).filter((p) => isAdministrator || can('REPORT', 'GENERATE_REPORTS', p.id))
}
