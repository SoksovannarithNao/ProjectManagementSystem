import { useState } from 'react'
import { User, Lock } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { updateOwnProfile } from '../api/users'
import { humanizeEnum } from '../api/format'

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other']

export function Settings() {
  const { profile, username, role, refreshProfile } = useAuth()
  const notify = useToast()

  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '')
  const [position, setPosition] = useState(profile?.position ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')
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
      setError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await updateOwnProfile({
        fullName: profile?.fullName ?? fullName.trim(),
        email: profile?.email ?? email.trim(),
        gender: profile?.gender ?? null,
        dateOfBirth: profile?.dateOfBirth ?? null,
        phoneNumber: profile?.phoneNumber ?? null,
        position: profile?.position ?? null,
        department: profile?.department ?? null,
        password,
      })
      setPassword('')
      setConfirmPassword('')
      notify('Password changed', { tone: 'success' })
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Manage your account profile and password" />

      <div className="grid max-w-[640px] grid-cols-1 gap-5">
        <section className="card px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <User size={17} className="text-muted" />
            <h3 className="section-title text-base">Profile</h3>
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

            {error && <p className="text-danger text-[12.5px] font-semibold">{error}</p>}

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
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                  required
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted text-[12.5px] font-semibold">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  className="bg-subtle border-border focus:border-lavender h-10 rounded-md border px-3 text-[13.5px] outline-none"
                  required
                />
              </label>
            </div>

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
