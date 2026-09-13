import { useState } from 'react'
import { User, Lock } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { updateOwnProfile, changeOwnPassword } from '../api/users'
import { humanizeEnum } from '../api/format'
import { PASSWORD_REQUIREMENTS_MESSAGE, isPasswordComplex } from '../api/validation'

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other']

export function Profile() {
  const { profile, username, role, refreshProfile } = useAuth()
  const notify = useToast()

  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '')
  const [position, setPosition] = useState(profile?.position ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileError('')
    setSavingProfile(true)
    try {
      await updateOwnProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        phoneNumber: phoneNumber.trim() || null,
        position: position.trim() || null,
        department: department.trim() || null,
      })
      await refreshProfile()
      notify('Profile updated', { tone: 'success' })
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (!isPasswordComplex(newPassword)) {
      setPasswordError(PASSWORD_REQUIREMENTS_MESSAGE)
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match')
      return
    }
    setSavingPassword(true)
    try {
      await changeOwnPassword({ currentPassword, newPassword, confirmNewPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      notify('Password changed', { tone: 'success' })
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div>
      <TopBar title="Profile" subtitle="Manage your personal information and password" />

      <div className="grid max-w-[640px] grid-cols-1 gap-5">
        <section className="card px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <User size={17} className="text-muted" />
            <h3 className="section-title text-base">Personal Information</h3>
          </div>

          <div className="bg-subtle border-border mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-md border px-4 py-3 text-[12.5px]">
            <span className="text-muted">
              Username: <span className="text-ink font-semibold">{username}</span>
            </span>
            <span className="text-muted">
              Role: <span className="text-ink font-semibold">{humanizeEnum(profile?.role || role)}</span>
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                required
              />
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Gender</span>
                <select
                  value={gender ?? ''}
                  onChange={(e) => setGender(e.target.value)}
                  className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g || 'Prefer not to say'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Date of birth</span>
                <input
                  type="date"
                  value={dateOfBirth ?? ''}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="bg-subtle border-border h-10 rounded-md border px-3 text-[13.5px] outline-none"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Phone number</span>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
              />
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Position</span>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Department</span>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                />
              </label>
            </div>

            {profileError && <p className="text-danger text-[12.5px] font-semibold">{profileError}</p>}

            <div className="mt-1 flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        <section className="card px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <Lock size={17} className="text-muted" />
            <h3 className="section-title text-base">Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-muted text-[12.5px] font-semibold">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                required
              />
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                  required
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Confirm new password</span>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                  required
                />
              </label>
            </div>
            <span className="text-faint -mt-2 text-[11.5px]">{PASSWORD_REQUIREMENTS_MESSAGE}</span>

            {passwordError && <p className="text-danger text-[12.5px] font-semibold">{passwordError}</p>}

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                {savingPassword ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
