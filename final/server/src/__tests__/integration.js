// @ts-check
const { gql } = require("graphql-tag");
const UserAPI = require("../datasources/user");
const LaunchAPI = require("../datasources/launch");

const {constructTestServer} = require('./__utils');

// the mocked REST API data
const {mockLaunchResponse} = require('../datasources/__tests__/launch');
// the mocked SQL DataSource store
const {mockStore} = require('../datasources/__tests__/user');

const GET_LAUNCHES = gql`
  query launchList($after: String) {
    launches(after: $after) {
      cursor
      hasMore
      launches {
        id
        isBooked
        rocket {
          name
        }
        mission {
          name
          missionPatch
        }
      }
    }
  }
`;

const GET_LAUNCH = gql`
  query launch($id: ID!) {
    launch(id: $id) {
      id
      isBooked
      rocket {
        type
      }
      mission {
        name
      }
    }
  }
`;

const LOGIN = gql`
  mutation login($email: String!) {
    login(email: $email) {
      token
    }
  }
`;

const BOOK_TRIPS = gql`
  mutation BookTrips($launchIds: [ID]!) {
    bookTrips(launchIds: $launchIds) {
      success
      message
      launches {
        id
        isBooked
      }
    }
  }
`;

describe('Queries', () => {
  it('fetches list of launches', async () => {
    const user = { id: 1, email: "a@a.a" };
    const launchAPI = new LaunchAPI();
    const userAPI = new UserAPI({
      store: mockStore,
      user,
    });

    // create an instance of ApolloServer that mocks out context, while reusing
    // existing dataSources, resolvers, and typeDefs.
    // This function returns the server instance as well as our dataSource
    // instances, so we can overwrite the underlying fetchers
    const { server } = constructTestServer();

    // mock the datasources' underlying fetch methods, whether that's a REST
    // lookup in the RESTDataSource or the store query in the Sequelize datasource
    launchAPI.get = jest.fn(() => [mockLaunchResponse]);
    userAPI.store.trips.findAll.mockReturnValueOnce([
      {dataValues: {launchId: 1}},
    ]);

    // We use server.executeOperation to run test queries
    // against our instance of ApolloServer
    const res = await server.executeOperation(
      { query: GET_LAUNCHES },
      {
        contextValue: {
          dataSources: { launchAPI, userAPI },
        },
      }
    );
    expect(res).toMatchSnapshot();
  });

  it('fetches single launch', async () => {
    const user = { id: 1, email: "a@a.a" };
    const launchAPI = new LaunchAPI();
    const userAPI = new UserAPI({
      store: mockStore,
      user,
    });

    const contextValue = {
      dataSources: { launchAPI, userAPI },
    };

    const { server } = constructTestServer();

    launchAPI.get = jest.fn(() => [mockLaunchResponse]);
    userAPI.store.trips.findAll.mockReturnValueOnce([
      {dataValues: {launchId: 1}},
    ]);

    const res = await server.executeOperation(
      { query: GET_LAUNCH, variables: { id: 1 } },
      { contextValue }
    );
    expect(res).toMatchSnapshot();
  });
});

describe('Mutations', () => {
  it('returns login token', async () => {
    const launchAPI = new LaunchAPI();
    const userAPI = new UserAPI({
      store: mockStore,
    });

    const contextValue = {
      dataSources: { launchAPI, userAPI },
    };

    const { server } = constructTestServer();

    userAPI.store.users.findOrCreate.mockReturnValueOnce([
      {id: 1, email: 'a@a.a'},
    ]);

    const res = await server.executeOperation(
      {
        query: LOGIN,
        variables: { email: "a@a.a" },
      },
      { contextValue }
    );

    expect(res.body.singleResult.data.login.token).toEqual("YUBhLmE=");
  });

  it('books trips', async () => {
    const user = { id: 1, email: "a@a.a" };
    const launchAPI = new LaunchAPI();
    const userAPI = new UserAPI({
      store: mockStore,
      user,
    });

    const contextValue = {
      user,
      dataSources: { launchAPI, userAPI },
    };

    const { server } = constructTestServer();

    // mock the underlying fetches
    launchAPI.get = jest.fn();

    // look up the launches from the launch API
    launchAPI.get
      .mockReturnValueOnce([mockLaunchResponse])
      .mockReturnValueOnce([{ ...mockLaunchResponse, flight_number: 2 }]);

    // book the trip in the store
    userAPI.store.trips.findOrCreate
      .mockReturnValueOnce([{ get: () => ({ launchId: 1 }) }])
      .mockReturnValueOnce([{ get: () => ({ launchId: 2 }) }]);

    // check if user is booked
    userAPI.store.trips.findAll.mockReturnValue([{}]);

    const res = await server.executeOperation(
      {
        query: BOOK_TRIPS,
        variables: { launchIds: ["1", "2"] },
      },
      { contextValue }
    );
    expect(res).toMatchSnapshot();
  });
});
