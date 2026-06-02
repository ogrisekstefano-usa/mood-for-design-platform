-- ITER187.B · Journey Mail Workspace™ — sidebar registration
-- Single INSERT into feature_modules_registry.
-- Touches NO other table (per Founder lock §12.7).
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO feature_modules_registry (
    code, display_name, category, description, default_state, required_role,
    position, is_core, nav_route, nav_icon, nav_group, nav_section_label,
    nav_visibility, nav_end_match, nav_has_mark, nav_test_id, nav_lazy_chunk,
    group_position, is_core_critical
) VALUES (
    'journey_mail_workspace',
    'Mail',
    'communications',
    'Multi-mailbox IMAP/SMTP workspace · Journey Mail Intelligence™',
    'enabled',
    'tenant_member',
    10,
    FALSE,
    '/communications/mail/mailboxes',
    'Mail',
    'communications',
    'Communications',
    'tenant',
    FALSE,
    FALSE,
    'sidebar-nav-mail',
    'journey_mail',
    35,
    FALSE
)
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    nav_route = EXCLUDED.nav_route,
    nav_icon = EXCLUDED.nav_icon,
    nav_group = EXCLUDED.nav_group,
    nav_section_label = EXCLUDED.nav_section_label,
    nav_test_id = EXCLUDED.nav_test_id,
    nav_lazy_chunk = EXCLUDED.nav_lazy_chunk,
    group_position = EXCLUDED.group_position,
    updated_at = NOW();

INSERT INTO public.schema_migrations(version)
  VALUES ('121_iter187b_journey_mail_module.sql')
  ON CONFLICT (version) DO NOTHING;
