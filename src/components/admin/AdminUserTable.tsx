import React from 'react'
import { Avatar, Badge, HStack, Table, Tbody, Td, Text, Th, Thead, Tr, BadgeProps } from '@chakra-ui/react'

export interface TableColumn<T> {
  header: string
  accessor?: keyof T | 'avatar' | 'status'
  render?: (row: T) => React.ReactNode
}

interface AdminUserTableProps<T> {
  rows: T[]
  columns: TableColumn<T>[]
  size?: 'sm' | 'md'
}

export const AdminUserTable = <T extends Record<string, unknown>>({ rows, columns, size = 'sm' }: AdminUserTableProps<T>) => {
  return (
    <Table variant="simple" size={size}>
      <Thead>
        <Tr>
          {columns.map(column => (
            <Th key={column.header}>{column.header}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map(row => (
          <Tr key={String((row as { id?: unknown; email?: unknown; name?: unknown }).id || row.email || row.name)}>
            {columns.map(column => {
              if (column.render) {
                return <Td key={column.header}>{column.render(row)}</Td>
              }

              if (column.accessor === 'avatar') {
                return (
                  <Td key={column.header}>
                    <HStack spacing={3}>
                      <Avatar size="sm" name={(row as { name?: string }).name} bg="brand.primary" color="white" />
                      <Text fontWeight="semibold" color="brand.text">{(row as { name?: string }).name}</Text>
                    </HStack>
                  </Td>
                )
              }

              if (column.accessor === 'status') {
                const statusValue = (row as Record<string, unknown>).status as string
                const colorScheme: BadgeProps['colorScheme'] = statusValue === 'Active' ? 'green' : 'yellow'
                return (
                  <Td key={column.header}>
                    <Badge colorScheme={colorScheme}>{statusValue}</Badge>
                  </Td>
                )
              }

              const value = column.accessor ? (row[column.accessor] as React.ReactNode) : null

              return (
                <Td key={column.header}>
                  <Text color="brand.text">{value}</Text>
                </Td>
              )
            })}
          </Tr>
        ))}
      </Tbody>
    </Table>
  )
}
