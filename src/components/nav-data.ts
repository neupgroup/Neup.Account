
export type NavItem = {
    href: string;
    label: string;
    description: string;
}

export type NavSection = {
    title: string | null;
    items: NavItem[];
}

export const navItems = {
    neupIdNav: [
        { 
            href: "/manage/home", 
            label: "Home", 
            description: "Your central account management hub.",
        },
        { 
            href: "/manage/profile", 
            label: "Personal Info", 
            description: "Manage your personal details and contact information.",
        },
        { 
            href: "/manage/notifications", 
            label: "Notifications", 
            description: "View and manage all your account notifications.",
        },
        { 
            href: "/manage/security", 
            label: "Password & Security", 
            description: "Update your password and manage your account's security.",
        },
        { 
            href: "/manage/accounts", 
            label: "Linked Accounts", 
            description: "Manage brand, branch, and dependent accounts.",
        },
        { 
            href: "/manage/data", 
            label: "Data & Privacy", 
            description: "See your data and the way we use it.",
        },
        { 
            href: "/manage/access", 
            label: "Access & Control", 
            description: "Manage who you share data and services with.",
        },
        { 
            href: "/manage/people", 
            label: "People & Sharing", 
            description: "Manage who you share data and services with.",
        },
        { 
            href: "/manage/payment", 
            label: "Payment & Subscription", 
            description: "Manage billing and subscriptions.",
        },
    ],
    managementNav: [
        { href: "/manage/root/dashboard", label: "Dashboard", description: "A high-level overview of key metrics and system status." },
        { href: "/manage/root/accounts", label: "Account Management", description: "Manage account roles and permissions." },
        { href: "/manage/root/requests", label: "Requests Management", description: "Review and act on pending user requests." },
        { href: "/manage/root/permission", label: "Permission Management", description: "Define system-wide permission sets." },
        { href: "/manage/root/app", label: "App Management", description: "Create, edit, and manage applications." },
        { href: "/manage/root/site", label: "Site Configuration", description: "Manage site-wide settings and error logs." },
    ],
    accountNav: [
        { href: "/auth/accounts", label: "Switch Account", description: "Switch between different NeupID accounts." },
        { href: "/auth/signout", label: "SignOut Account", description: "Sign out of your account." },
    ],
};


export const allPermissionsMap: Record<string, string[]> = {
    "Home": [],
    "Personal Info": ['profile.view', 'profile.modify', 'contact.view', 'contact.add', 'contact.modify', 'contact.remove'],
    "Notifications": ['notification.read'],
    "Password & Security": [
        'security.pass.modify', 'security.totp.add', 'security.totp.remove', 'security.backup_codes.view', 
        'security.backup_codes.create', 'security.recovery_accounts.view', 'security.recovery_accounts.add', 
        'security.recovery_accounts.remove', 'security.recovery_phone.view', 'security.recovery_phone.add', 
        'security.recovery_phone.remove', 'security.recovery_email.view', 'security.recovery_email.add', 
        'security.recovery_email.remove', 'security.login_devices.view'
    ],
    "Linked Accounts": ['linked_accounts.brand.create', 'linked_accounts.brand.view', 'linked_accounts.dependent.create', 'linked_accounts.dependent.view'],
    "Data & Privacy": [
        'data.agreed_terms.view', 'data.delete_account.start', 'data.deactivate_account.start', 
        'data.materialization.view', 'data.materialization.modify', 'security.third_party.view', 'security.recent_activities.view'
    ],
    "Access & Control": ['security.third_party.view', 'security.third_party.add', 'security.third_party.remove'],
    "People & Sharing": ['people.family.view', 'people.family.add', 'people.family.remove', 'people.family.partner.add', 'people.family.partner.remove', 'people.block_list.view', 'people.restrict_list.view'],
    "Payment & Subscription": ['payment.method.show', 'payment.transactions.show', 'payment.subscriptions.show', 'payment.purchase_neup_pro.view'],
    "Dashboard": ["root.dashboard.view"],
    "Account Management": ["root.account.search", "root.account.create_individual"],
    "Requests Management": ["root.requests.view"],
    "Permission Management": ["root.permission.view"],
    "App Management": ["root.app.view"],
    "Site Configuration": ["root.payment_config.view", "root.errors.view"],
    "Branches": ['linked_accounts.brand.manage'],
    "Blocked Users": ['people.block_list.view', 'people.restrict_list.view'],
};
