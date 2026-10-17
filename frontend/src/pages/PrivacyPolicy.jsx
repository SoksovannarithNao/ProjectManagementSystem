import { Link } from 'react-router-dom'
import { LegalDocument } from '../components/public/LegalDocument'
import { PUBLIC_PATHS, SITE } from '../config/site'

const mail = (
  <a href={`mailto:${SITE.contactEmail}`} className="text-ink font-semibold hover:underline">
    {SITE.contactEmail}
  </a>
)

// Written from how the application actually behaves (backend, database and frontend code). When the
// behaviour changes (a new provider, a new kind of data, a new retention rule), change this text and
// SITE.privacyUpdated together.
const SECTIONS = [
  {
    id: 'who-we-are',
    heading: 'Who we are',
    body: (
      <>
        <p>
          {SITE.name} is a project and task management web application available at {SITE.url}. It is operated by{' '}
          {SITE.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what personal data the application
          handles, why, who else receives it, and what you can ask us to do with it.
        </p>
        <p>You can reach us at {mail}.</p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    heading: 'What we collect',
    body: (
      <>
        <p>
          <strong>Account details.</strong> Your full name, username, e-mail address and password. The password is kept
          only as a one-way hash (BCrypt); it is never stored or shown in readable form. Your account also has a role,
          a status (for example active or suspended) and the date it was created.
        </p>
        <p>
          <strong>Optional profile details.</strong> Gender, date of birth, phone number, job position, department and
          a profile photo, if you or an administrator add them. Your theme and notification preferences are saved with
          your account.
        </p>
        <p>
          <strong>Work you create.</strong> Projects, tasks, subtasks, checklists, milestones, comments (including
          @mentions), approval requests and decisions, time entries, and files you attach (up to 10 MB each). Files and
          profile photos are stored in the database.
        </p>
        <p>
          <strong>Activity records.</strong> A history of who did what and when (on tasks and projects), in-app
          notifications sent to you, and an administrator audit log of changes to accounts, roles, permissions and
          project ownership, which records the name of the person who made the change and the account or project it
          concerned.
        </p>
        <p>
          <strong>Sign-in and session data.</strong> When you sign in, a refresh token is stored on our server only as a
          hash, and a matching cookie is placed in your browser. E-mail verification codes are stored only as hashes and
          expire after a short time. Failed sign-in attempts are counted in the server&apos;s memory, by network address
          and name, to limit password guessing; this count is not written to the database.
        </p>
        <p>
          <strong>Information kept in your browser.</strong> Your username and role (to restore your session), your theme
          choice, and the time of your last activity (to sign you out when you are idle) are kept in your browser&apos;s
          local storage. The refresh cookie is an essential, HTTP-only cookie. We do not use advertising or analytics
          cookies or trackers.
        </p>
        <p>
          <strong>Technical logs.</strong> The application writes a log of errors and security events (for example failed
          sign-ins and rejected requests) so that problems can be found. The hosting providers named below may also keep
          their own technical logs of requests, which can include network addresses.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    heading: 'How we use it',
    body: (
      <>
        <ul>
          <li>to create and secure your account, sign you in, and decide what you are allowed to see and do;</li>
          <li>to run projects and tasks: assigning work, showing progress, sending notifications and deadline reminders;</li>
          <li>to send you e-mails the service needs, such as a verification code;</li>
          <li>to keep a record of changes for accountability, and to detect and prevent misuse;</li>
          <li>to find and fix faults.</li>
        </ul>
        <p>
          We do not sell your personal data, and the application shows no advertising and does no advertising profiling.
        </p>
      </>
    ),
  },
  {
    id: 'who-can-see-it',
    heading: 'Who can see your information',
    body: (
      <>
        <p>
          Inside {SITE.name}, what other people can see is limited by their role. Administrators can see user accounts.
          Other signed-in people can access the profile details (name, username, e-mail address, position, department and,
          if you provided them, gender, date of birth and phone number) only if they share an active project with you.
          Tasks, comments and files in a project are visible to that project&apos;s members according to their project
          role.
        </p>
        <p>
          <strong>Profile photos are different.</strong> A photo is served from an unguessable web address that works
          without signing in, so that it can appear next to your name. Anyone who has that exact address can open the
          picture.
        </p>
      </>
    ),
  },
  {
    id: 'service-providers',
    heading: 'Service providers and third parties',
    body: (
      <>
        <p>
          We do not share your personal data with anyone else except the providers that run the service, and where the
          law requires it. These providers process data on our behalf:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the website you are viewing and forwards requests from it to the server.
          </li>
          <li>
            <strong>Render</strong> hosts the application server.
          </li>
          <li>
            <strong>Neon</strong> hosts the database (PostgreSQL) where all of the data above is stored, in the
            Asia-Pacific (Singapore) region.
          </li>
          <li>
            <strong>Google</strong>: (a) the pages load the Archivo typeface from Google Fonts, so your browser requests
            it from Google&apos;s servers; and (b) the application sends e-mail through the Gmail API of the
            operator&apos;s own Google account, which means the recipient&apos;s e-mail address and the message (for
            example a verification code) pass through Google when an e-mail is sent. See the next section.
          </li>
        </ul>
        <p>
          These providers have their own privacy policies. Because they run in other countries, your data may be
          processed outside the country where you live.
        </p>
      </>
    ),
  },
  {
    id: 'google',
    heading: 'Google sign-in and Google user data',
    body: (
      <>
        <p>
          <strong>{SITE.name} does not offer &ldquo;Sign in with Google&rdquo;</strong> and does not ask you to connect
          your own Google account. You sign in with a username (or e-mail address) and a password.
        </p>
        <p>
          Google OAuth is used for one purpose only: the operator authorised the application, once, to send e-mail from
          the operator&apos;s own Gmail address. The only permission requested is{' '}
          <code className="bg-subtle rounded px-1 py-0.5 text-[12px]">https://www.googleapis.com/auth/gmail.send</code>
          , which allows sending messages and nothing else. The application does not read, list, search, modify or delete
          any mailbox, and it does not receive or store any Google account data belonging to you or any other user.
        </p>
        <p>
          The access credentials for that one account are held as private server configuration at the hosting provider.
          They are not stored in the database and are never shown to users. The operator can withdraw the permission at
          any time in their Google account settings.
        </p>
        <p>
          {SITE.name}&apos;s use of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-ink font-semibold hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    heading: 'How we protect it',
    body: (
      <>
        <ul>
          <li>The website and the server are reached over HTTPS.</li>
          <li>Passwords, refresh tokens and verification codes are stored only as hashes.</li>
          <li>
            Access tokens are short-lived (15 minutes). The refresh cookie is HTTP-only and sent only to this site, and
            you are signed out after a period of inactivity.
          </li>
          <li>
            Every request is checked on the server against your role and your project membership, not only in the
            screens.
          </li>
          <li>Repeated failed sign-ins temporarily lock further attempts for that address and name.</li>
          <li>The application connects to the database with an account that has only the permissions it needs.</li>
        </ul>
        <p>
          No system is completely secure, and we cannot guarantee absolute security. If you believe your account has
          been compromised, change your password and tell us at {mail}.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep it, and deletion',
    body: (
      <>
        <p>
          We keep your data while your account exists. A registration that is never confirmed with its e-mailed code is
          deleted automatically after 24 hours.
        </p>
        <p>
          <strong>To have your account deleted, write to {mail}</strong> from the e-mail address on the account (or ask
          the administrator of your workspace). {SITE.name} has no self-service delete button; an administrator deletes
          the account. When an account is deleted:
        </p>
        <ul>
          <li>
            <strong>removed:</strong> the profile and photo, project memberships and task assignments, the comments you
            wrote, your time entries, notifications, sign-in sessions and verification codes;
          </li>
          <li>
            <strong>kept, but no longer linked to your account:</strong> tasks, checklist items, files and approval
            requests you created, and entries in the activity history (their text may still mention your name); and the
            administrator audit log keeps the name of the account in its record that the deletion happened.
          </li>
        </ul>
        <p>
          An account that still manages a project cannot be deleted until the project is handed to someone else. The
          database provider may keep backups or history of the database for a limited time after data is deleted.
        </p>
      </>
    ),
  },
  {
    id: 'your-choices',
    heading: 'Your choices',
    body: (
      <>
        <p>
          Once signed in you can change your own profile details, photo and password, and your theme and notification
          preferences. You can ask us at {mail} for a copy of the personal data we hold about you, to correct it, or to
          delete it. We may need to confirm that the request comes from you. Depending on where you live, you may have
          further rights under local law.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        When we change how data is handled we will update this page and its &ldquo;Last updated&rdquo; date. See also
        the{' '}
        <Link to={PUBLIC_PATHS.terms} className="text-ink font-semibold hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: (
      <p>
        {SITE.operator}, operator of {SITE.name} &mdash; {mail}.
      </p>
    ),
  },
]

export function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated={SITE.privacyUpdated}
      intro={
        <p>
          This policy describes how {SITE.name} handles personal data. It is based on how the application works today;
          where something is optional or depends on how your administrator uses the service, we say so.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
