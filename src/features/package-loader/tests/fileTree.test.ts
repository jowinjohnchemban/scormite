/**
 * Unit tests for buildFileTree — the pure archive-path → tree builder.
 */

import { describe, expect, it } from 'vitest'
import { buildFileTree } from '../services/fileTree'

describe('buildFileTree', () => {
  it('returns an empty tree for no files', () => {
    expect(buildFileTree([])).toEqual([])
  })

  it('builds a single top-level file', () => {
    const tree = buildFileTree(['index.html'])
    expect(tree).toEqual([
      {
        name: 'index.html',
        path: 'index.html',
        isDirectory: false,
        children: [],
      },
    ])
  })

  it('groups nested paths into directories before files', () => {
    const tree = buildFileTree(['course/main.js', 'index.html', 'course/style.css'])
    expect(tree).toEqual([
      {
        name: 'course',
        path: 'course',
        isDirectory: true,
        children: [
          { name: 'main.js', path: 'course/main.js', isDirectory: false, children: [] },
          { name: 'style.css', path: 'course/style.css', isDirectory: false, children: [] },
        ],
      },
      { name: 'index.html', path: 'index.html', isDirectory: false, children: [] },
    ])
  })

  it('normalizes backslashes to forward slashes', () => {
    const tree = buildFileTree(['res\\scormdriver\\index.html'])
    expect(tree[0]).toMatchObject({
      name: 'res',
      path: 'res',
      isDirectory: true,
      children: [
        {
          name: 'scormdriver',
          path: 'res/scormdriver',
          isDirectory: true,
          children: [
            {
              name: 'index.html',
              path: 'res/scormdriver/index.html',
              isDirectory: false,
              children: [],
            },
          ],
        },
      ],
    })
  })

  it('strips a leading ./ prefix', () => {
    const tree = buildFileTree(['./index.html'])
    expect(tree).toEqual([
      { name: 'index.html', path: 'index.html', isDirectory: false, children: [] },
    ])
  })

  it('ignores empty paths', () => {
    expect(buildFileTree([''])).toEqual([])
  })

  it('sorts directories first, then files, case-insensitively', () => {
    const tree = buildFileTree(['Zed.js', 'alpha.js', 'Assets/img.png', 'asset.css'])
    // Directories first (Assets), then files alphabetically ignoring case:
    // alpha.js < asset.css < Zed.js
    expect(tree.map((n) => n.name)).toEqual(['Assets', 'alpha.js', 'asset.css', 'Zed.js'])
    expect(tree[0]).toMatchObject({ isDirectory: true, path: 'Assets' })
    expect(tree[1]).toMatchObject({ isDirectory: false, path: 'alpha.js' })
  })

  it('merges shared directory prefixes into one node', () => {
    const tree = buildFileTree(['a/b/c.txt', 'a/b/d.txt', 'a/e.txt'])
    expect(tree).toEqual([
      {
        name: 'a',
        path: 'a',
        isDirectory: true,
        children: [
          {
            name: 'b',
            path: 'a/b',
            isDirectory: true,
            children: [
              { name: 'c.txt', path: 'a/b/c.txt', isDirectory: false, children: [] },
              { name: 'd.txt', path: 'a/b/d.txt', isDirectory: false, children: [] },
            ],
          },
          { name: 'e.txt', path: 'a/e.txt', isDirectory: false, children: [] },
        ],
      },
    ])
  })

  it('treats an explicit trailing-slash path segment as a directory', () => {
    const tree = buildFileTree(['assets/'])
    expect(tree).toEqual([
      { name: 'assets', path: 'assets', isDirectory: true, children: [] },
    ])
  })
})
