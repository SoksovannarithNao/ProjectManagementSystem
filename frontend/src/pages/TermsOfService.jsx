import { Link } from 'react-router-dom'
import { LegalDocument } from '../components/public/LegalDocument'
import { PUBLIC_PATHS, SITE } from '../config/site'

const mail = (
  <a href={`mailto:${SITE.contactEmail}`} className="text-ink font-semibold hover:underline">
    {SITE.contactEmail}
  </a>
)

// Written from what the application does (roles, permissions, limits, account statuses). Keep it in step
// with the product and bump SITE.termsUpdated when the substance changes.
const SECTIONS = [
  {
    id: 'agreement',
    heading: 'Agreement',
    body: (
      <p>
        These terms apply to your use of {SITE.name} at {SITE.url}, operated by {SITE.operator}. By creating an account
        or using the service you agree to them. If you do not agree, do not use the service.
      </p>
    ),
  },
  {
    id: 'the-service',
    heading: 'The service',
    body: (
      <p>
        {SITE.name} is a project and task management application: projects, tasks, milestones, comments, files, a
        Kanban board, a calendar, notifications, reports and role-based access control. Features may change over time.
      </p>
    ),
  },
  {
    id: 'accounts',
    heading: 'Accounts',
    body: (
      <>
        <ul>
          <li>
            An account is created by an administrator, or you register yourself and confirm your e-mail address with a
            one-time code.
          </li>
          <li>Give accurate information and keep it up to date. One account belongs to one person.</li>
          <li>
            Keep your password confidential and choose one that meets the password rules. You are responsible for what
            happens under your account. If you think someone else has used it, change your password and tell us at {mail}.
          </li>
          <li>
            Repeated failed sign-ins temporarily block further attempts, and you are signed out after a period of
            inactivity. These are security measures, not penalties.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>break the law, or use the service to harm, harass or defraud anyone;</li>
          <li>upload or share content you have no right to share, or content that is unlawful or malicious (including malware);</li>
          <li>
            try to access data or functions you have not been given access to, bypass a permission, or probe or
            disrupt the service or its security;
          </li>
          <li>guess other people&apos;s passwords, or use someone else&apos;s account;</li>
          <li>send automated or excessive traffic that degrades the service for others.</li>
        </ul>
        <p>Files you attach are limited in size (10 MB each) and may be refused if their type is not allowed.</p>
      </>
    ),
  },
  {
    id: 'your-content',
    heading: 'Your content',
    body: (
      <>
        <p>
          You keep ownership of the projects, tasks, comments and files you add. You allow the service to store them and
          to show them to the people you share them with, according to project roles, so that the service can work. You
          are responsible for your content and for having the right to add it. Keep your own copies of anything
          important.
        </p>
      </>
    ),
  },
  {
    id: 'projects-and-roles',
    heading: 'Projects, tasks and roles',
    body: (
      <ul>
        <li>
          What you can do in a project depends on your project role (Project Manager, Team Leader, Team Member or
          Viewer) and on the permissions your administrator has set.
        </li>
        <li>
          People with the right permission in a project (normally its Project Manager and Team Leaders) can add others to
          it and change roles within it. Administrators can manage accounts, roles and permissions and can see every
          project.
        </li>
        <li>
          Changes to work are recorded in an activity history, and changes to accounts, roles and permissions in an
          administrator audit log, as described in the{' '}
          <Link to={PUBLIC_PATHS.privacy} className="text-ink font-semibold hover:underline">
            Privacy Policy
          </Link>
          .
        </li>
        <li>A completed project or task is closed: it accepts no new tasks, comments, files or time entries.</li>
      </ul>
    ),
  },
  {
    id: 'availability',
    heading: 'Availability',
    body: (
      <p>
        The service is provided on third-party hosting and may be slow, interrupted or unavailable at times, for example
        during maintenance or when a provider has a fault. We do not promise it will be uninterrupted or error-free, and
        we may change or stop parts of it.
      </p>
    ),
  },
  {
    id: 'termination',
    heading: 'Suspension and ending your account',
    body: (
      <>
        <p>
          You can stop using the service at any time, and you can ask us at {mail} to delete your account (see the
          Privacy Policy for what that removes).
        </p>
        <p>
          An administrator can deactivate, suspend or delete an account, for example if these terms are broken or the
          account is no longer needed. A suspended or deactivated account cannot sign in.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    heading: 'Disclaimer and liability',
    body: (
      <p>
        The service is provided &ldquo;as is&rdquo;, without promises beyond those the law requires. To the extent the law
        allows, {SITE.operator} is not liable for indirect or consequential loss, or for loss of data, arising from your
        use of the service. Nothing in these terms limits any right you have under the law that cannot be limited.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: (
      <p>
        We may update these terms. The &ldquo;Last updated&rdquo; date shows when they last changed; continuing to use
        the service after a change means you accept the updated terms.
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

export function TermsOfService() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated={SITE.termsUpdated}
      intro={
        <p>
          These terms set out what you can expect from {SITE.name} and what is expected of you. Please read them together
          with the{' '}
          <Link to={PUBLIC_PATHS.privacy} className="text-ink font-semibold hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  )
}
