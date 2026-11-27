const mongoose = require('mongoose');
const JobPosting = require('../models/JobPosting');
const {
  getRecruiterPostingsWithCounts,
  findOwnedJobPosting,
} = require('./jobQueries');

jest.mock('../models/JobPosting');

describe('jobQueries', () => {
  const recruiterId = '507f1f77bcf86cd799439011';
  const otherRecruiterId = '507f1f77bcf86cd799439099';
  const jobId = '507f1f77bcf86cd799439033';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecruiterPostingsWithCounts', () => {
    it('aggregates postings owned by the recruiter with applicantCount sorted newest first', async () => {
      const mockResults = [{ _id: jobId, title: 'Engineer', applicantCount: 3 }];
      JobPosting.aggregate.mockResolvedValue(mockResults);

      const result = await getRecruiterPostingsWithCounts(recruiterId);

      expect(JobPosting.aggregate).toHaveBeenCalledWith([
        { $match: { postedBy: mongoose.Types.ObjectId.createFromHexString(recruiterId) } },
        {
          $lookup: {
            from: 'applications',
            localField: '_id',
            foreignField: 'job',
            as: 'applications',
          },
        },
        {
          $addFields: {
            applicantCount: { $size: '$applications' },
          },
        },
        {
          $project: {
            applications: 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ]);
      expect(result).toEqual(mockResults);
    });
  });

  describe('findOwnedJobPosting', () => {
    it('throws 404 when the job posting does not exist', async () => {
      JobPosting.findById.mockResolvedValue(null);

      await expect(findOwnedJobPosting(jobId, recruiterId)).rejects.toMatchObject({
        message: 'Job not found',
        statusCode: 404,
      });
    });

    it('throws 403 with custom action label when another recruiter owns the posting', async () => {
      JobPosting.findById.mockResolvedValue({
        _id: jobId,
        postedBy: { toString: () => otherRecruiterId },
      });

      await expect(findOwnedJobPosting(jobId, recruiterId, 'archive')).rejects.toMatchObject({
        message: 'You can only archive your own job postings',
        statusCode: 403,
      });
    });

    it('returns the job document when owned by the requesting recruiter', async () => {
      const job = {
        _id: jobId,
        postedBy: { toString: () => recruiterId },
      };
      JobPosting.findById.mockResolvedValue(job);

      const result = await findOwnedJobPosting(jobId, recruiterId);
      expect(result).toBe(job);
    });
  });
});