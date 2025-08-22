# Table Permission:
Collection name: permission
Document ID: random_string
Fields: {
    access: string,
    app_id: string
    description: permission_description
    name: permission_name
}



## NEUP.WHOLE: Default permission document for NeupAccount (NeupID)
app_id: neup_console
description: Grants full access to all system features.
name: root.whole
access: {
    root.dashboard.view
    root.account.view_full
    root.account.view_limited1
    root.account.view_limited2
    root.account.search
    root.account.create_individual
    root.account.view_activity
    root.account.impersonate
    root.account.send_warning
    root.account.give_block_account
    root.account.remove_block_account
    root.requests.view
    root.requests.approve
    root.requests.deny
    root.permission.view
    root.permission.create
    root.permission.edit
    root.permission.delete
    root.permission.bulk_import
    root.app.view
    root.app.create
    root.payment_config.view
    root.payment_config.edit
    root.errors.view
    root.site.social_accounts.read
    root.site.social_accounts.add
    root.site.social_accounts.edit
    root.site.social_accounts.delete
}



## ROOT.WHOLE: Default permission document for NeupAccount (NeupID)
app_id: neup_console
description: Grants access to standard, non-administrative features.
name: individual.default
access: {
    profile.view
    profile.modify
    contact.view
    contact.add
    contact.modify
    contact.remove
    security.pass.modify
    security.totp.add
    security.totp.remove
    security.backup_codes.view
    security.backup_codes.create
    security.recovery_accounts.view
    security.recovery_accounts.add
    security.recovery_accounts.remove
    security.recovery_phone.view
    security.recovery_phone.add
    security.recovery_phone.remove
    security.recovery_email.view
    security.recovery_email.add
    security.recovery_email.remove
    security.login_devices.view
    security.recent_activities.view
    security.third_party.view
    data.agreed_terms.view
    data.delete_account.start
    data.deactivate_account.start
    data.materialization.view
    data.materialization.modify
    linked_accounts.brand.create
    linked_accounts.brand.view
    linked_accounts.brand.manage
    linked_accounts.dependent.create
    linked_accounts.dependent.view
    people.family.view
    people.family.add
    people.family.remove
    people.family.partner.add
    people.family.partner.remove
    payment.method.show
    payment.transactions.show
    payment.subscriptions.show
    payment.purchase_neup_pro.view
    notification.read
    notification.mark_as_read
}
