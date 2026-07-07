const fc = require('fast-check');
const { createEnv } = require('../helpers/join-password-env.cjs');

describe('Join_Password trạng thái Enabled/Disabled', () => {
  const { groups } = createEnv();

  // Giá trị có thể rỗng / undefined / chuỗi không rỗng.
  const maybeField = fc.oneof(
    fc.constant(''),
    fc.constant(undefined),
    fc.string({ minLength: 1, maxLength: 24 }),
  );

  // **Feature: group-password, Property 5: Trạng thái Enabled/Disabled xác định bởi hash và salt**
  it('isJoinPasswordEnabled true ⟺ cả hash và salt không rỗng; xác minh trên nhóm Disabled luôn không khớp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ joinPwHash: maybeField, joinPwSalt: maybeField }),
        fc.string({ maxLength: 40 }),
        async (group, candidate) => {
          const enabled = groups.isJoinPasswordEnabled(group);
          const expected = Boolean(group.joinPwHash) && Boolean(group.joinPwSalt);
          expect(enabled).toBe(expected);
          // Trên nhóm Disabled, verify mọi chuỗi phải trả về false (không băm).
          if (!enabled) {
            const ok = await groups.verifyGroupJoinPassword(group, candidate);
            expect(ok).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
