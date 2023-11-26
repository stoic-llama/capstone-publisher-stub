const { healthcheck } = require('../../controller/healthcheckController')

// Refer testing nested response - https://codewithhugo.com/express-request-response-mocking#mockingstubbing-res-a-simple-express-response-with-jest
// Refer testing arbitrary values with timestamp - https://stackoverflow.com/q/52337116
test('success passes 200 status and heartbeat json', async () => {
    const mockRequest = () => {}
    const mockResponse = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    const req = mockRequest()
    const res = mockResponse()
    await healthcheck(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
        name: 'capstone-publisher-stub',
        message: 'UP',
        uptime: expect.anything(),
        timestamp: expect.anything()   
    })
})

test('failure passes 500 status and error json', async () => {
    const mockRequest = () => {}
    const mockResponse = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockImplementationOnce(() => { 
            throw new Error(
                {
                    name: 'capstone-publisher-stub',
                    message: expect.anything(),
                    uptime: expect.anything(),
                    timestamp: expect.anything()   
                }
            );    
        });

        return res;
    };

    const req = mockRequest()
    const res = mockResponse()
    await healthcheck(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
        name: 'capstone-publisher-stub',
        message: expect.anything(),
        uptime: expect.anything(),
        timestamp: expect.anything()   
    })
})