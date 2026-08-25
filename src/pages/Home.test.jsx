import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import Home from './Home'

test('renders home title', () => {
  render(<Home />)

  expect(
    screen.getByRole('heading', { name: /inicio/i })
  ).toBeInTheDocument()
})