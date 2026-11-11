const requireRole = require('./requireRole');

jest.mock('../models/User');
const User = require('../models/User');

describe('requireRole middleware', () => {
    it('allows access when user has required role', async () => {
        const req = { user: { id: '507f1f77bcf86cd799439011' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        User.findById.mockResolvedValue({ role: 'recruiter' });

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 when user lacks required role', async () => {
        const req = { user: { id: '507f1f77bcf86cd799439011' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        User.findById.mockResolvedValue({ role: 'job_seeker' });

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 when user not found in database', async () => {
        const req = { user: { id: '507f1f77bcf86cd799439011' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        User.findById.mockResolvedValue(null);

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when user.id is missing', async () => {
        const req = { user: {} };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when user object is missing', async () => {
        const req = {};
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('supports multiple required roles', async () => {
        const req = { user: { id: '507f1f77bcf86cd799439011' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        User.findById.mockResolvedValue({ role: 'job_seeker' });

        const middleware = requireRole('recruiter', 'admin');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('sets role on successful verification', async () => {
        const req = { user: { id: '507f1f77bcf86cd799439011' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        User.findById.mockResolvedValue({ _id: req.user.id, role: 'recruiter' });

        const middleware = requireRole('recruiter');
        await middleware(req, res, next);

        expect(req.user.role).toBe('recruiter');
        expect(next).toHaveBeenCalled();
    });
});
