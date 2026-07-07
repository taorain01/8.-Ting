// Helper nạp js/crypto.js + js/groups.js vào một sandbox vm để test tính năng
// Join_Password mà không cần trình duyệt/Firebase thật. Chỉ dùng cho test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CRYPTO_SRC = fs.readFileSync(path.join(ROOT, 'js', 'crypto.js'), 'utf8');
const GROUPS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'groups.js'), 'utf8');

// Đưa các hàm/hằng nội bộ của groups.js ra ngoài để test truy cập trực tiếp.
const GROUPS_EXPORT_SNIPPET = `
;globalThis.__tingJoinExports = {
  isJoinPasswordEnabled,
  isValidJoinPasswordLength,
  verifyGroupJoinPassword,
  setGroupJoinPassword,
  removeGroupJoinPassword,
  acceptGroupInvite,
  assertJoinRateLimitOk,
  registerJoinFailure,
  clearJoinFailures,
  getGroupById,
  isGroupUnlocked,
  groupHasSharedPassword,
  verifyGroupPassword,
  MIN_JOIN_PASSWORD_LENGTH,
  MAX_JOIN_PASSWORD_LENGTH,
  JOIN_MAX_ATTEMPTS,
  JOIN_LOCK_MS,
};
`;

const CRYPTO_EXPORT_SNIPPET = `
;globalThis.__tingCryptoExports = {
  generateSalt,
  hashJoinPassword,
  verifyJoinPassword,
  hashSharedPassword,
  verifySharedPassword,
  hashMasterPassword,
};
`;

// Mock Firestore tối thiểu: hỗ trợ collection().doc().update() và FieldValue.
function makeFirestoreMock(options = {}) {
  const calls = [];
  const failUpdate = options.failUpdate || false;
  const hangUpdate = options.hangUpdate || false;
  const db = {
    collection() {
      return {
        doc() {
          return {
            async update(payload) {
              calls.push(payload);
              if (hangUpdate) return new Promise(() => {}); // không bao giờ resolve
              if (failUpdate) throw new Error('Firestore update failed');
              return true;
            },
          };
        },
      };
    },
  };
  const firebase = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => '__ts__',
        delete: () => '__delete__',
        arrayUnion: (v) => ({ __arrayUnion: v }),
        arrayRemove: (v) => ({ __arrayRemove: v }),
      },
    },
  };
  return { db, firebase, calls };
}

function createEnv(options = {}) {
  const isDemo = options.isDemo !== false; // mặc định demo (không cần Firestore)
  const user = options.user || { uid: 'owner-1', email: 'owner@example.com' };
  const { db, firebase, calls } = makeFirestoreMock(options);

  const appState = {
    isDemo,
    user,
    groups: [],
    groupInvites: [],
    sharedAccounts: {},
    sharedEditRequests: {},
    groupUnlocked: {},
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    Promise,
    Error,
    TextEncoder,
    TextDecoder,
    crypto: nodeCrypto.webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    // stub Firebase
    auth: { currentUser: null },
    db,
    firebase,
  };
  sandbox.window = { appState };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(CRYPTO_SRC + CRYPTO_EXPORT_SNIPPET, sandbox);
  vm.runInContext(GROUPS_SRC + GROUPS_EXPORT_SNIPPET, sandbox);

  return {
    sandbox,
    appState,
    calls,
    groups: sandbox.__tingJoinExports,
    cryptoFns: sandbox.__tingCryptoExports,
  };
}

module.exports = { createEnv, makeFirestoreMock };
