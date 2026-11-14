module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  cllectCoverageFrom: [
  	'src/**/*.{js,jsx}',
  	'!src/**/*.test.{js,jsx}',
  	'!src/setupTests.js',
  	'!src/main.jsx',
  ],
  coverageDirectory:'coverage',
  coverageReporters:['text','html','lcov'],
}
