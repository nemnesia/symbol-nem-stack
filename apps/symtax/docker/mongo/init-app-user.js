const symtaxDatabase = db.getSiblingDB('symtax');
const applicationUsername = process.env.SYMTAX_MONGO_APP_USERNAME;
const applicationPassword = process.env.SYMTAX_MONGO_APP_PASSWORD;

if (!applicationUsername || !applicationPassword) {
  throw new Error('SymTax MongoDB application credentials are required');
}

symtaxDatabase.createUser({
  user: applicationUsername,
  pwd: applicationPassword,
  roles: [{ role: 'readWrite', db: 'symtax' }],
});
