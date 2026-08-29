import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Roles, STAFF_ROLES } from "../../common/decorators/roles.decorator";
import { StudentsService } from "./students.service";
import { AuditService } from "../audit/audit.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { QueryStudentDto } from "./dto/query-student.dto";
import { BulkImportStudentDto } from "./dto/bulk-import-student.dto";
import { ToggleSubjectItemPassDto } from "./dto/subject-item-pass.dto";

@ApiTags("students")
@Roles(...STAFF_ROLES)
@Controller("students")
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("stats")
  @ApiOperation({ summary: "Get student stats" })
  async getStats(
    @Req() req: any,
    @Query("schoolId") schoolId: string = "",
    @Query("levelId") levelId?: string,
    @Query("groupId") groupId?: string,
    @Query("status") status?: string,
    @Query("gradeId") gradeId?: string,
    @Query("gender") gender?: string,
    @Query("churchName") churchName?: string,
    @Query("search") search?: string,
  ) {
    return this.studentsService.getStats(
      schoolId,
      { levelId, groupId, status, gradeId, gender, churchName, search },
      req.user,
    );
  }

  @Get()
  @ApiOperation({ summary: "Get all students" })
  @ApiResponse({ status: 200, description: "Students retrieved successfully" })
  async findAll(
    @Req() req: any,
    @Query() queryDto: QueryStudentDto,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.findAll(queryDto, schoolId, req.user);
  }

  @Get("levels/all")
  @ApiOperation({ summary: "Get all levels" })
  async getLevels(@Query("schoolId") schoolId: string = "") {
    return this.studentsService.getLevels(schoolId);
  }

  @Get("groups/all")
  @ApiOperation({ summary: "Get all groups" })
  async getGroups(@Query("schoolId") schoolId: string = "") {
    return this.studentsService.getGroups(schoolId);
  }

  @Post("groups")
  @ApiOperation({ summary: "Create a new group" })
  async createGroup(
    @Body() body: { name: string; nameAr?: string; description?: string },
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.createGroup(schoolId, body);
  }

  @Patch("groups/:id")
  @ApiOperation({ summary: "Update group" })
  async updateGroup(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      nameAr?: string;
      description?: string;
      status?: string;
    },
  ) {
    return this.studentsService.updateGroup(id, body);
  }

  @Delete("groups/:id")
  @ApiOperation({ summary: "Delete group" })
  @ApiResponse({ status: 200, description: "Group deleted successfully" })
  async deleteGroup(@Param("id") id: string) {
    return this.studentsService.deleteGroup(id);
  }

  @Delete("groups")
  @ApiOperation({ summary: "Delete all groups" })
  @ApiResponse({ status: 200, description: "All groups deleted successfully" })
  async deleteAllGroups(@Query("schoolId") schoolId: string = "") {
    return this.studentsService.deleteAllGroups(schoolId);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Bulk import students" })
  async bulkImport(
    @Body() dto: BulkImportStudentDto,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.bulkCreate(dto, schoolId);
  }

  @Patch("bulk")
  @ApiOperation({ summary: "Bulk update students" })
  async bulkUpdate(
    @Body() dto: { ids: string[]; data: Partial<UpdateStudentDto> },
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.bulkUpdate(dto.ids, dto.data, schoolId);
  }

  @Post("bulk-delete")
  @ApiOperation({ summary: "Bulk delete students" })
  async bulkDelete(
    @Body() dto: { ids: string[] },
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.bulkDelete(dto.ids, schoolId);
  }

  @Post("bulk-assign-servant")
  @ApiOperation({ summary: "Bulk assign a servant to students" })
  async bulkAssignServant(
    @Body() dto: { ids: string[]; servantId: string },
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.bulkAssignServant(dto.ids, dto.servantId, schoolId);
  }

  @Get("duplicates")
  @ApiOperation({ summary: "Find potential duplicate students" })
  async findDuplicates(@Query("schoolId") schoolId: string = "") {
    return this.studentsService.findDuplicates(schoolId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get student by ID" })
  @ApiResponse({ status: 200, description: "Student retrieved successfully" })
  @ApiResponse({ status: 404, description: "Student not found" })
  async findOne(
    @Param("id") id: string,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.findOne(id, schoolId);
  }

  @Post()
  @ApiOperation({ summary: "Create a new student" })
  @ApiResponse({ status: 201, description: "Student created successfully" })
  async create(
    @Body() createStudentDto: CreateStudentDto,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.create(createStudentDto, schoolId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update student" })
  @ApiResponse({ status: 200, description: "Student updated successfully" })
  async update(
    @Param("id") id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.update(id, updateStudentDto, schoolId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete student (soft delete)" })
  @ApiResponse({ status: 200, description: "Student deleted successfully" })
  async remove(
    @Param("id") id: string,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.remove(id, schoolId);
  }

  @Patch(":id/tags")
  @ApiOperation({ summary: "Set student tags" })
  async updateTags(
    @Param("id") id: string,
    @Body() dto: { tags: string[] },
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.updateTags(id, dto.tags || [], schoolId);
  }

  @Get(":id/attendance")
  @ApiOperation({ summary: "Get student attendance history" })
  async getAttendanceHistory(
    @Param("id") id: string,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.getAttendanceHistory(id, schoolId);
  }

  @Get(":id/progress")
  @ApiOperation({ summary: "Get student progress" })
  async getProgress(
    @Param("id") id: string,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.studentsService.getProgress(id, schoolId);
  }

  @Get(":id/activity")
  @ApiOperation({ summary: "Get student activity log" })
  async getActivity(
    @Param("id") id: string,
    @Query("schoolId") schoolId: string = "",
  ) {
    return this.auditService.findByEntity("student", id, 50, schoolId);
  }

  @Roles("servant", "group_leader", "level_leader", "admin", "super_admin")
  @Post(":id/subject-items/:itemId/pass")
  @ApiOperation({ summary: "Toggle passed status for a subject item" })
  async togglePass(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: ToggleSubjectItemPassDto,
    @Req() req: any,
  ) {
    const result = await this.studentsService.toggleSubjectItemPass(
      id,
      itemId,
      req.user,
      dto,
    );
    await this.auditService.log({
      action: result.passed
        ? "subject_item_passed"
        : "subject_item_pass_revoked",
      entityType: "student",
      entityId: id,
      userId: req.user?.id,
      metadata: { subjectItemId: itemId },
      schoolId: req.query?.schoolId || undefined,
    });
    return result;
  }

  @Roles(
    "servant",
    "group_leader",
    "level_leader",
    "admin",
    "super_admin",
    "parent",
  )
  @Get(":id/subject-items")
  @ApiOperation({ summary: "Get allocated subject items with pass status" })
  async getSubjectItems(@Param("id") id: string, @Req() req: any) {
    return this.studentsService.getStudentSubjectItems(id, req.user);
  }

  @Roles(
    "servant",
    "group_leader",
    "level_leader",
    "admin",
    "super_admin",
    "parent",
  )
  @Get(":id/subject-items/history")
  @ApiOperation({ summary: "Get subject item pass history" })
  async getPassHistory(@Param("id") id: string, @Req() req: any) {
    return this.studentsService.getStudentPassHistory(id, req.user);
  }
}
