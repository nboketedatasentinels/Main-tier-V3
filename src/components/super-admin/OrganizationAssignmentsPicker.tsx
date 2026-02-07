import React, { useMemo, useState } from 'react'
import {
  Box,
  FormHelperText,
  HStack,
  Input,
  Select,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'

export type OrganizationAssignmentOption = {
  id?: string | null
  name?: string | null
  code?: string | null
  status?: string | null
}

interface OrganizationAssignmentsPickerProps {
  organizations: OrganizationAssignmentOption[]
  value: string[]
  onChange: (nextIds: string[]) => void
  isDisabled?: boolean
  helperText?: string
  placeholder?: string
  allowInactive?: boolean
}

const normalize = (value: string[]) =>
  Array.from(
    new Set(
      (value || [])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  )

const orgLabel = (org: { id: string; name?: string; code?: string; status?: string }) => {
  const base = org.name || org.code || org.id
  const codeSuffix = org.code ? ` (${org.code})` : ''
  const statusSuffix = org.status && org.status !== 'active' ? ` \u2022 ${org.status}` : ''
  return `${base}${codeSuffix}${statusSuffix}`
}

export const OrganizationAssignmentsPicker: React.FC<OrganizationAssignmentsPickerProps> = ({
  organizations,
  value,
  onChange,
  isDisabled = false,
  helperText,
  placeholder = 'Select organization to add',
  allowInactive = false,
}) => {
  const selectedIds = useMemo(() => normalize(value), [value])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const organizationList = useMemo(() => {
    return (organizations || [])
      .map((org) => ({
        id: (org.id || '').toString(),
        name: (org.name || '').toString(),
        code: org.code ? org.code.toString() : '',
        status: org.status ? org.status.toString() : '',
      }))
      .filter((org) => Boolean(org.id))
      .sort((a, b) => (a.name || orgLabel(a)).localeCompare(b.name || orgLabel(b)))
  }, [organizations])

  const organizationLookup = useMemo(
    () => new Map(organizationList.map((org) => [org.id, org])),
    [organizationList],
  )

  const selectedOrganizations = useMemo(
    () =>
      selectedIds.map((orgId) => organizationLookup.get(orgId) || { id: orgId, name: orgId, code: '', status: '' }),
    [organizationLookup, selectedIds],
  )

  const [search, setSearch] = useState('')

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return organizationList
    return organizationList.filter((org) => {
      const haystack = `${org.name} ${org.code} ${org.id}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [organizationList, search])

  const addableOrganizations = useMemo(
    () =>
      filteredOrganizations.filter((org) => {
        if (selectedSet.has(org.id)) return false
        if (!allowInactive && org.status && org.status !== 'active') return false
        return true
      }),
    [allowInactive, filteredOrganizations, selectedSet],
  )

  const handleAdd = (orgId: string) => {
    const trimmed = orgId.trim()
    if (!trimmed || selectedSet.has(trimmed)) return
    onChange([...selectedIds, trimmed])
  }

  const handleRemove = (orgId: string) => {
    onChange(selectedIds.filter((id) => id !== orgId))
  }

  return (
    <Box>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search organizations (name, code, or ID)"
        mb={2}
        isDisabled={isDisabled}
      />
      <Select
        value=""
        onChange={(e) => {
          const nextId = e.target.value
          if (nextId) handleAdd(nextId)
        }}
        placeholder={placeholder}
        isDisabled={isDisabled}
      >
        {addableOrganizations.map((org) => (
          <option key={org.id} value={org.id}>
            {orgLabel(org)}
          </option>
        ))}
      </Select>

      {helperText ? (
        <FormHelperText color="gray.600">
          <HStack justify="space-between" align="baseline">
            <Text>{helperText}</Text>
            <Text>{selectedIds.length ? `${selectedIds.length} selected` : ''}</Text>
          </HStack>
        </FormHelperText>
      ) : (
        <FormHelperText color="gray.600">{selectedIds.length ? `${selectedIds.length} selected` : ''}</FormHelperText>
      )}

      {selectedOrganizations.length ? (
        <Box mt={3} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
          <Wrap spacing={2}>
            {selectedOrganizations.map((org) => (
              <WrapItem key={org.id}>
                <Tag size="md" variant="subtle" colorScheme={org.status && org.status !== 'active' ? 'orange' : 'purple'}>
                  <TagLabel>{orgLabel(org)}</TagLabel>
                  <TagCloseButton onClick={() => handleRemove(org.id)} isDisabled={isDisabled} />
                </Tag>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      ) : null}
    </Box>
  )
}

