/* eslint-disable @typescript-eslint/no-var-requires */
import Server from './server';
import { ServerTransport } from './transports/server-transport';
import { Router } from './router';

// Create test classes we'll use directly
class TestRouter implements Partial<Router> {
  public isMethodImplemented = jest.fn();
  public call = jest.fn();
}

class TestTransport extends ServerTransport {
  public options: any;
  
  constructor(options: any = {}) {
    super();
    this.options = options;
  }
  
  public start = jest.fn().mockResolvedValue(undefined);
  public stop = jest.fn().mockResolvedValue(undefined);
}

// Create factory functions to use in tests
const createTestRouter = () => new TestRouter() as unknown as Router;
const createTestTransport = (options: any = {}) => new TestTransport(options);

// Mock MethodCallValidator
jest.mock('@open-rpc/schema-utils-js', () => ({
  MethodCallValidator: jest.fn().mockImplementation(() => ({
    validate: jest.fn(),
  })),
}));

describe('Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => { /* no-op */ });
  });

  it('initializes without routers or transports when no options provided', () => {
    const server = new Server({ openrpcDocument: {} as any });
    expect((server as any).routers).toHaveLength(0);
    expect((server as any).transports).toHaveLength(0);
  });

  it('adds router when constructed with methodMapping', () => {
    // Mock Router constructor
    const originalRouter = require('./router').Router;
    const mockRouter = createTestRouter();
    require('./router').Router = jest.fn().mockReturnValue(mockRouter);
    
    const mapping = {} as any;
    const server = new Server({ openrpcDocument: {} as any, methodMapping: mapping });
    
    // Verify Router was created with expected args
    expect(require('./router').Router).toHaveBeenCalledWith({} as any, mapping);
    expect((server as any).routers).toHaveLength(1);
    
    // Restore original Router
    require('./router').Router = originalRouter;
  });

  it('adds default transport when constructed with transportConfigs', () => {
    // Mock the transport factory
    const originalTransports = require('./transports').default;
    const mockTransport = createTestTransport({ port: 123 });
    require('./transports').default = { 
      HTTPTransport: jest.fn().mockReturnValue(mockTransport)
    };
    
    // Mock the Router class to prevent it from trying to use actual MethodCallValidator
    const originalRouter = require('./router').Router;
    require('./router').Router = jest.fn().mockReturnValue(createTestRouter());
    
    const opts = { port: 123 } as any;
    const server = new Server({
      openrpcDocument: {} as any,
      methodMapping: {} as any,
      transportConfigs: [{ type: 'HTTPTransport', options: opts }],
    });
    
    expect(console.log).toHaveBeenCalledWith(
      `Adding Transport of the type HTTPTransport on port ${opts.port}`,
    );
    
    expect((server as any).transports).toHaveLength(1);
    expect((server as any).transports[0]).toBe(mockTransport);
    expect(mockTransport.options).toEqual(opts);
    
    // Restore original modules
    require('./transports').default = originalTransports;
    require('./router').Router = originalRouter;
  });

  it('throws error on invalid transport type in addDefaultTransport', () => {
    const server = new Server({ openrpcDocument: {} as any });
    expect(() => {
      (server as any).addDefaultTransport('InvalidTransport' as any, {} as any);
    }).toThrow(
      'The transport "InvalidTransport" is not a valid transport type.',
    );
  });

  it('registers transport and attaches existing routers in addTransport', () => {
    const server = new Server({ openrpcDocument: {} as any });
    
    // Create test data
    const router1 = createTestRouter();
    const router2 = createTestRouter();
    (server as any).routers = [router1, router2];
    
    const transport = createTestTransport();
    jest.spyOn(transport, 'addRouter');
    
    server.addTransport(transport);
    
    expect(transport.addRouter).toHaveBeenCalledTimes(2);
    expect(transport.addRouter).toHaveBeenCalledWith(router1);
    expect(transport.addRouter).toHaveBeenCalledWith(router2);
    expect((server as any).transports).toContain(transport);
  });

  it('registers router and attaches to existing transports in addRouter', () => {
    // Mock Router constructor
    const originalRouter = require('./router').Router;
    const mockRouter = createTestRouter();
    require('./router').Router = jest.fn().mockReturnValue(mockRouter);
    
    const server = new Server({ openrpcDocument: {} as any });
    
    // Create test data
    const transport = createTestTransport();
    jest.spyOn(transport, 'addRouter');
    (server as any).transports = [transport];
    
    const router = server.addRouter({} as any, {} as any);
    
    expect(require('./router').Router).toHaveBeenCalledWith({}, {} as any);
    expect(transport.addRouter).toHaveBeenCalledWith(router);
    expect((server as any).routers).toContain(router);
    
    // Restore original Router
    require('./router').Router = originalRouter;
  });

  it('deregisters router and detaches from transports in removeRouter', () => {
    const server = new Server({ openrpcDocument: {} as any });
    
    // Create test data
    const router = createTestRouter();
    const transport = createTestTransport();
    jest.spyOn(transport, 'removeRouter');
    
    (server as any).transports = [transport];
    (server as any).routers = [router];
    
    server.removeRouter(router);
    
    expect((server as any).routers).not.toContain(router);
    expect(transport.removeRouter).toHaveBeenCalledWith(router);
  });

  it('calls start on transports in start', async () => {
    const server = new Server({ openrpcDocument: {} as any });
    
    // Create test data
    const transport = createTestTransport();
    
    (server as any).transports = [transport];
    
    await server.start();
    
    expect(transport.start).toHaveBeenCalled();
  });

  it('calls stop on transports in stop', async () => {
    const server = new Server({ openrpcDocument: {} as any });
    
    // Create test data
    const transport = createTestTransport();
    
    (server as any).transports = [transport];
    
    await server.stop();
    
    expect(transport.stop).toHaveBeenCalled();
  });

  it('rolls back started transports if a later transport fails to start', async () => {
    const server = new Server({ openrpcDocument: {} as any });

    const first = createTestTransport();
    const second = createTestTransport();
    const error = new Error('boom');

    first.start.mockResolvedValue(undefined);
    second.start.mockRejectedValue(error);

    (server as any).transports = [first, second];

    await expect(server.start()).rejects.toThrow('boom');
    expect(first.stop).toHaveBeenCalled();
    expect(second.stop).not.toHaveBeenCalled();
  });

  it('continues stopping transports when one fails', async () => {
    const server = new Server({ openrpcDocument: {} as any });

    const first = createTestTransport();
    const second = createTestTransport();
    first.stop.mockRejectedValue(new Error('fail'));
    second.stop.mockResolvedValue(undefined);

    (server as any).transports = [first, second];

    await expect(server.stop()).rejects.toThrow('fail');
    expect(second.stop).toHaveBeenCalled();
  });
});
