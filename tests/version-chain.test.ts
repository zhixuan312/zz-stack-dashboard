import { unretainedVersions } from '@/components/VersionChain';

/* The rule this guards: `_versions/` freezes a copy per approval while the version counter
 * advances per revision, so a draft revised again before anyone approved it consumes a number
 * and leaves no file behind. The hole is real and the console must name it rather than
 * listing v1, v3, v4 and saying nothing. */
describe('unretainedVersions', () => {
  it('names the version a revision consumed before any approval', () => {
    expect(unretainedVersions([1, 3, 4, 9999])).toEqual([2]);
  });

  it('says nothing when every version was approved', () => {
    expect(unretainedVersions([1, 2, 9999])).toEqual([]);
    expect(unretainedVersions([1, 9999])).toEqual([]);
  });

  it('names every number in a run of unapproved revisions', () => {
    expect(unretainedVersions([1, 4, 9999])).toEqual([2, 3]);
  });

  /* 9999 is the live document's sentinel, not a version. Counting it would report 9,998
   * missing versions on a document approved once. */
  it('excludes the live-document sentinel from the range', () => {
    expect(unretainedVersions([9999])).toEqual([]);
    expect(unretainedVersions([1, 2, 3, 9999])).toEqual([]);
  });

  it('is silent on a document with no versions at all', () => {
    expect(unretainedVersions([])).toEqual([]);
  });

  /* The API orders by version, but the rule must not depend on that: a set is a set. */
  it('does not depend on the order the versions arrive in', () => {
    expect(unretainedVersions([9999, 4, 1, 3])).toEqual([2]);
  });
});
