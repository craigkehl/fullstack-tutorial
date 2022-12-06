import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server';
import isEmail from 'isemail';

import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { createStore } from './utils.js';

import LaunchAPI from './datasources/launch.js';
import UserAPI from './datasources/user.js';

dotenv.config();
// creates a sequelize connection once. NOT for every request
const store = createStore();

// set up any dataSources our resolvers need
const dataSources = () => ({
  launchAPI: new LaunchAPI(),
  userAPI: new UserAPI({ store }),
});

// the function that sets up the global context for each resolver, using the req
const context = async ({ req }) => {
  // simple auth check on every request
  const auth = (req.headers && req.headers.authorization) || '';
  const email = Buffer.from(auth, 'base64').toString('ascii');

  // if the email isn't formatted validly, return null for user
  if (!isEmail.validate(email)) return { user: null };
  // find a user by their email
  const users = await store.users.findOrCreate({ where: { email } });
  const user = users && users[0] ? users[0] : null;

  return { user: { ...user.dataValues } };
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources,
  context,
});

// Start our server if we're not in a test env.
// if we're in a test env, we'll manually start it in a test
server.listen().then(() => {
  console.log(`
    Server is running!
    Listening on port 4000
    Explore at https://studio.apollographql.com/sandbox
  `);
});
