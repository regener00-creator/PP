-- NOOSOL WEBSITE only. Its existing exposed schemas were verified as
-- public, graphql_public before this change. On another project, preserve its
-- existing list and add pp through the Dashboard instead of blindly running this.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, pp';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
