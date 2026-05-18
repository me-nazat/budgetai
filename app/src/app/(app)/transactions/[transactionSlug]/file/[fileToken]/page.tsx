import TransactionAttachmentViewer from '@/components/TransactionAttachmentViewer';

interface FileViewerPageProps {
  params: Promise<{
    transactionSlug: string;
    fileToken: string;
  }>;
}

export default async function FileViewerPage({ params }: FileViewerPageProps) {
  const { transactionSlug, fileToken } = await params;
  return <TransactionAttachmentViewer fileToken={fileToken} transactionSlug={transactionSlug} />;
}
