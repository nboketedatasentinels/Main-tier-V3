import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { format } from 'date-fns'
import {
  IMPACT_CATS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  claimInputsFromRecord,
  valuation,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import type { ImpactLogRecord } from '@/services/impactLogService'
import { downloadImprovementValueReportPdf } from '@/reports/t4lImprovementValueReportPdf'

type Props = {
  entries: ImpactLogRecord[]
  rates: ImpactRateCard[]
  user?: unknown
  profile?: { companyName?: string | null; companyId?: string | null } | null
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Learner/partner export: CSV for systems, PDF board pack (Template 1).
 * Kept to those two hand-offs so the tab is not a draft collage.
 */
export const ImpactExportPanel: React.FC<Props> = ({ entries, rates, profile }) => {
  const toast = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const registerCsv = useMemo(() => {
    const head = [
      'id',
      'type',
      'title',
      'date',
      'status',
      'tier',
      'category',
      'waste_or_growth',
      'net_per_period_usd',
      'bucket',
      'hours',
      'people',
    ]
    const rows = entries.map((e) => {
      const inputs = claimInputsFromRecord(e)
      const v = inputs ? valuation(inputs, rates) : null
      const cat =
        IMPACT_CATS.find((c) => c.k === e.claim?.cat)?.n ||
        e.businessCategory ||
        e.esgCategory ||
        ''
      const sub =
        e.claim?.cat === 'rev'
          ? IMPACT_GROWTH.find((g) => g.k === e.claim?.growth)?.n
          : IMPACT_WASTES.find((w) => w.k === e.claim?.waste)?.n
      return [
        e.id,
        e.entryKind || e.categoryGroup,
        e.title,
        e.date,
        e.claimStatus || e.verificationStatus,
        v?.tier ?? '',
        cat,
        sub || '',
        v && v.tier > 1 ? Math.round(v.net) : e.usdValue ?? 0,
        e.claim?.bucket || '',
        e.hours,
        e.peopleImpacted,
      ]
    })
    return [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  }, [entries, rates])

  const downloadCsv = () => {
    try {
      const blob = new Blob([registerCsv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `t4l_impact_export_${today}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 500)
      toast({ status: 'success', title: 'CSV downloaded' })
    } catch {
      toast({ status: 'error', title: 'CSV download failed' })
    }
  }

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const name = await downloadImprovementValueReportPdf({
        entries,
        rates,
        orgName: profile?.companyName,
      })
      toast({
        status: 'success',
        title: 'PDF downloaded',
        description: name,
      })
    } catch (err) {
      toast({
        status: 'error',
        title: 'PDF download failed',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <Stack spacing={5}>
      <Box>
        <Heading size="md" mb={1}>
          Export
        </Heading>
        <Text fontSize="sm" color="text.secondary" maxW="54ch">
          Two hand-offs only: a CSV for Excel or finance systems, and the Template 1 PDF board pack.
        </Text>
      </Box>

      <Flex gap={4} flexWrap="wrap">
        <Box
          flex="1"
          minW="240px"
          p={5}
          rounded="xl"
          bg="surface.default"
          border="1px solid"
          borderColor="border.subtle"
        >
          <HStack spacing={2} mb={2}>
            <FileSpreadsheet size={18} />
            <Text fontWeight="bold">CSV</Text>
          </HStack>
          <Text fontSize="sm" color="text.secondary" mb={4}>
            One row per improvement claim and ESG entry. Open in Excel or import to finance tools.
          </Text>
          <Button
            colorScheme="primary"
            leftIcon={<Download size={16} />}
            onClick={downloadCsv}
            isDisabled={entries.length === 0}
          >
            Download CSV
          </Button>
        </Box>

        <Box
          flex="1"
          minW="240px"
          p={5}
          rounded="xl"
          bg="tint.brandPrimary"
          border="1px solid"
          borderColor="border.subtle"
        >
          <HStack spacing={2} mb={2}>
            <FileText size={18} />
            <Text fontWeight="bold">PDF</Text>
          </HStack>
          <Text fontSize="sm" color="text.secondary" mb={4}>
            Improvement value report (Template 1) for board and leadership packs.
          </Text>
          <Button
            colorScheme="primary"
            leftIcon={<Download size={16} />}
            onClick={() => void downloadPdf()}
            isLoading={pdfBusy}
            loadingText="Building PDF…"
            isDisabled={entries.length === 0}
          >
            Download PDF
          </Button>
        </Box>
      </Flex>

      {entries.length === 0 && (
        <Text fontSize="sm" color="text.muted">
          Log an improvement or ESG entry first, then export.
        </Text>
      )}
    </Stack>
  )
}
