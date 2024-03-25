define([], () => {
  /** 
   * Helper function to track calls on a method.
   * @return a function that can be substituted for a method,
   *   which tracks the call count and the call arguments. 
   * 
   * Example usage:
   * const x = new ClassWithMethods();
   * const spy = createSpy();
   * x.method1 = spy; 
   * 
   * x.methodThatCallsMethod1Indirectly();
   * 
   * expect(spy.callCount).to.equal(1);
   * 
   */
  return () => {
    const spy = (...args) => {
      spy.callCount++;
      spy.callArgs.push(args);
    }

    spy.reset = () => {
      spy.callCount = 0;
      spy.callArgs = [];
    }

    spy.reset();

    return spy;
  };
});