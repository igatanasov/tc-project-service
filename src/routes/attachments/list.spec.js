/* eslint-disable no-unused-expressions */
import chai from 'chai';
import request from 'supertest';

import models from '../../models';
import server from '../../app';
import testUtil from '../../tests/util';
import { ATTACHMENT_TYPES } from '../../constants';

const should = chai.should();

describe('Project Attachments download', () => {
  let project1;

  beforeEach((done) => {
    testUtil.clearDb()
      .then(() => testUtil.clearES())
        .then(() => {
          models.Project.create({
            type: 'generic',
            directProjectId: 1,
            billingAccountId: 1,
            name: 'test1',
            description: 'test project1',
            status: 'draft',
            details: {},
            createdBy: 1,
            updatedBy: 1,
            lastActivityAt: 1,
            lastActivityUserId: '1',
          }).then((p) => {
            project1 = p;
            // create members
            return models.ProjectMember.create({
              userId: 40051332,
              projectId: project1.id,
              role: 'copilot',
              isPrimary: true,
              createdBy: 1,
              updatedBy: 1,
            }).then(() => models.ProjectAttachment.bulkCreate([{
              projectId: project1.id,
              title: 'test.txt',
              description: 'blah',
              contentType: 'application/unknown',
              size: 12312,
              category: null,
              path: 'https://media.topcoder.com/projects/1/test.txt',
              type: ATTACHMENT_TYPES.FILE,
              tags: ['tag1', 'tag2'],
              createdBy: testUtil.userIds.copilot,
              updatedBy: 1,
            }, {
              projectId: project1.id,
              title: 'link test 1',
              description: 'link test description',
              size: 123456,
              category: null,
              path: 'https://media.topcoder.com/projects/1/test2.txt',
              type: ATTACHMENT_TYPES.LINK,
              tags: ['tag3'],
              createdBy: testUtil.userIds.copilot,
              updatedBy: 1,
            }]).then(() => done()));
          });
        });
  });

  after((done) => {
    testUtil.clearDb(done);
  });

  describe('List /projects/{id}/attachments', () => {
    it('should return 403 for anonymous user', (done) => {
      request(server)
        .get(`/v5/projects/${project1.id}/attachments`)
        .expect(403, done);
    });

    it('should return 403 for member', (done) => {
      request(server)
        .get(`/v5/projects/${project1.id}/attachments`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .send()
        .expect(403, done);
    });

    it('should return 200 for manager', (done) => {
      request(server)
        .get(`/v5/projects/${project1.id}/attachments`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send()
        .expect(200, done);
    });

    it('should return 200 for copilot', (done) => {
      request(server)
        .get(`/v5/projects/${project1.id}/attachments`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send()
        .expect(200, done);
    });

    it('should return 200 for admin', (done) => {
      request(server)
        .get(`/v5/projects/${project1.id}/attachments`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send()
        .expect(200)
        .end((err, res) => {
          const resJson = res.body;
          resJson.should.have.length(2);
          resJson[0].description.should.be.eql('blah');
          resJson[0].path.should.be.eql('https://media.topcoder.com/projects/1/test.txt');
          resJson[0].projectId.should.be.eql(project1.id);
          resJson[0].type.should.be.eql(ATTACHMENT_TYPES.FILE);
          resJson[0].createdBy.should.be.eql(testUtil.userIds.copilot);
          resJson[0].updatedBy.should.be.eql(1);
          should.exist(resJson[0].createdAt);
          should.exist(resJson[0].updatedAt);
          should.not.exist(resJson[0].deletedBy);
          should.not.exist(resJson[0].deletedAt);

          resJson[1].projectId.should.be.eql(project1.id);
          resJson[1].description.should.be.eql('link test description');
          resJson[1].path.should.be.eql('https://media.topcoder.com/projects/1/test2.txt');
          resJson[1].type.should.be.eql(ATTACHMENT_TYPES.LINK);
          resJson[1].tags.should.be.eql(['tag3']);
          resJson[1].createdBy.should.be.eql(testUtil.userIds.copilot);
          resJson[1].updatedBy.should.be.eql(1);
          should.exist(resJson[0].createdAt);
          should.exist(resJson[0].updatedAt);
          should.not.exist(resJson[0].deletedBy);
          should.not.exist(resJson[0].deletedAt);

          done();
        });
    });
  });
});
