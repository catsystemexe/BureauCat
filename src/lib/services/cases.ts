import { prisma } from "@/lib/prisma";
import { removeStoredOriginalDocument } from "@/lib/documents/storage";
import type { CreateCaseInput, UpdateCaseInput } from "@/lib/validation/cases";

const caseSelect = {
  id: true,
  title: true,
  area: true,
  status: true,
  icon: true,
  icon_color: true,
  created_at: true,
  updated_at: true,
  _count: {
    select: {
      documents: true,
      situations: true
    }
  }
};

type SelectedCase = {
  id: string;
  title: string;
  area: string | null;
  status: string;
  icon: string;
  icon_color: string;
  created_at: Date;
  updated_at: Date;
  _count: {
    documents: number;
    situations: number;
  };
};

function toCaseSummary(caseItem: SelectedCase) {
  return {
    id: caseItem.id,
    title: caseItem.title,
    area: caseItem.area,
    status: caseItem.status,
    icon: caseItem.icon,
    icon_color: caseItem.icon_color,
    created_at: caseItem.created_at,
    updated_at: caseItem.updated_at,
    document_count: caseItem._count.documents,
    situation_count: caseItem._count.situations
  };
}

export async function listCases() {
  const cases = await prisma.case.findMany({
    orderBy: { created_at: "desc" },
    select: caseSelect
  });

  return cases.map(toCaseSummary);
}

export async function createCase(input: CreateCaseInput) {
  return prisma.$transaction(async (transaction) => {
    const createdCase = await transaction.case.create({
      data: {
        title: input.title,
        area: input.area ?? null,
        icon: input.icon ?? "folder",
        icon_color: input.icon_color ?? "#3b82f6",
        status: "draft"
      },
      select: caseSelect
    });

    await transaction.situation.create({
      data: {
        case_id: createdCase.id,
        title: "Situace 1",
        description: null,
        status: "active",
        display_order: 0
      }
    });

    const refreshedCase = await transaction.case.findUniqueOrThrow({
      where: { id: createdCase.id },
      select: caseSelect
    });

    return toCaseSummary(refreshedCase);
  });
}

export async function getCaseById(id: string) {
  const foundCase = await prisma.case.findUnique({
    where: { id },
    select: caseSelect
  });

  return foundCase ? toCaseSummary(foundCase) : null;
}

export async function updateCase(id: string, input: UpdateCaseInput) {
  const updatedCase = await prisma.case.update({
    where: { id },
    data: input,
    select: caseSelect
  });

  return toCaseSummary(updatedCase);
}

export async function deleteCase(
  id: string,
  options: { deleteUploadedFiles: boolean } = { deleteUploadedFiles: false }
) {
  const existingCase = await prisma.case.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      documents: {
        select: {
          id: true,
          original_file: true
        }
      }
    }
  });

  if (!existingCase) {
    return null;
  }

  const originalFiles = Array.from(
    new Set(
      existingCase.documents
        .map((document) => document.original_file)
        .filter((originalFile) => originalFile.trim().length > 0)
    )
  );

  const sharedFiles = originalFiles.length
    ? await prisma.document.findMany({
        where: {
          case_id: { not: id },
          original_file: { in: originalFiles }
        },
        select: {
          original_file: true
        }
      })
    : [];

  const sharedFileSet = new Set(sharedFiles.map((document) => document.original_file));

  await prisma.case.delete({
    where: { id }
  });

  const deletedFiles: string[] = [];
  const skippedSharedFiles: string[] = [];
  const failedFiles: Array<{ original_file: string; error: string }> = [];

  if (options.deleteUploadedFiles) {
    for (const originalFile of originalFiles) {
      if (sharedFileSet.has(originalFile)) {
        skippedSharedFiles.push(originalFile);
        continue;
      }

      try {
        await removeStoredOriginalDocument(originalFile);
        deletedFiles.push(originalFile);
      } catch (error) {
        failedFiles.push({
          original_file: originalFile,
          error: error instanceof Error ? error.message : "Unknown file deletion error."
        });
      }
    }
  }

  return {
    deleted: true,
    case: {
      id: existingCase.id,
      title: existingCase.title
    },
    documents_deleted_from_db: existingCase.documents.length,
    uploaded_files_deleted: deletedFiles.length,
    uploaded_files_skipped_shared: skippedSharedFiles.length,
    uploaded_file_delete_errors: failedFiles
  };
}
