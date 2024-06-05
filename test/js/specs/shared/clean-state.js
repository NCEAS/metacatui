define([], () => {
  /**
   * Helper function to prevent state from leaking across test runs.
   * @param callback is a function that would typically be passed as a parameter
   *   to a beforeEach test lifecycle function. In this case we control when it
   *   is called so that we can return some state from it.
   * @param testLifecycleFunction a mocha test lifecycle function like beforeEach
   *   that will be executed according to the testing framework's rules.
   * @return an object containing all of the state of an individual test.
   *
   * Example usage:
   *
   * const state = cleanState(() => {
   *   const someClassInstance = new ClassToBeUsedInTest();
   *
   *   return { someClassInstance };
   * }, beforeEach);
   *
   * Now state.someClassInstance can be used with a guarantee that it won't leak
   * state from test to test.
   */
  return (callback, testLifecycleFunction) => {
    const state = {};

    testLifecycleFunction(() => {
      // Delete all properties on state, but don't change the reference.
      for (const field in state) {
        if (state.hasOwnProperty(field)) {
          delete state[field];
        }
      }

      // Add new properties to state, but don't change the reference.
      Object.assign(state, callback() || {});
    });

    return state;
  };
});
