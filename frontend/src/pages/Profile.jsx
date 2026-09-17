import { useRef, useState } from 'react'
import { User, Lock, Pencil } from 'lucide-react'
import { TopBar } from '../layout/TopBar'
import { Avatar } from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthContext'
import { updateOwnProfile, changeOwnPassword, uploadProfilePhoto, deleteProfilePhoto } from '../api/users'
import { initialsFor } from '../api/format'
import { PASSWORD_REQUIREMENTS_MESSAGE, isPasswordComplex } from '../api/validation'

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function Profile() {
  const { profile, username, refreshProfile } = useAuth()
  const notify = useToast()
  const photoInputRef = useRef(null)

  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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
      })
      await refreshProfile()
      notify('Profile updated', { tone: 'success' })
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file next time
    if (!file) return

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      notify('Photo must be a JPEG, PNG, WEBP, or GIF image', { tone: 'error' })
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      notify('Photo is too large (max 5MB)', { tone: 'error' })
      return
    }

    setUploadingPhoto(true)
    try {
      await uploadProfilePhoto(file)
      await refreshProfile()
      notify('Profile photo updated', { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to upload photo', { tone: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true)
    try {
      await deleteProfilePhoto()
      await refreshProfile()
      notify('Profile photo removed', { tone: 'success' })
    } catch (err) {
      notify(err.message || 'Failed to remove photo', { tone: 'error' })
    } finally {
      setUploadingPhoto(false)
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

          <div className="mb-5 flex items-center gap-4">
            <button
              type="button"
              className="group relative shrink-0 cursor-pointer rounded-full border-none bg-none p-0 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label={profile?.profilePhotoUrl ? 'Change profile photo' : 'Upload profile photo'}
              title={profile?.profilePhotoUrl ? 'Change profile photo' : 'Upload profile photo'}
            >
              <Avatar
                initials={initialsFor(fullName || username)}
                color="var(--accent-purple)"
                photoUrl={profile?.profilePhotoUrl}
                size={64}
              />
              <span className="bg-charcoal text-white group-hover:bg-lavender pointer-events-none absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card transition-colors">
                <Pencil size={11} />
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelected}
              className="hidden"
            />
            <div className="flex flex-col items-start gap-2">
              <span className="text-faint text-[11.5px]">JPEG, PNG, WEBP, or GIF — up to 5MB</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-1.5 text-[12.5px]"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto
                    ? 'Uploading…'
                    : profile?.profilePhotoUrl
                      ? 'Change Photo'
                      : 'Upload Photo'}
                </button>
                {profile?.profilePhotoUrl && (
                  <button
                    type="button"
                    className="text-danger text-[11.5px] font-semibold"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-subtle border-border mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-md border px-4 py-3 text-[12.5px]">
            <span className="text-muted">
              Username: <span className="text-ink font-semibold">{username}</span>
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
