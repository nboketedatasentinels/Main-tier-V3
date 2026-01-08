# Weekly podcast content Firestore indexes

Composite indexes required for weekly podcast queries.

## weekly_content: weekNumber + journeyType + isActive
- **Collection**: `weekly_content`
- **Fields**:
  - `weekNumber` **Ascending**
  - `journeyType` **Ascending**
  - `isActive` **Ascending**
- **Query support**: Fetch active weekly podcasts for a journey using week number and journey type filters.
