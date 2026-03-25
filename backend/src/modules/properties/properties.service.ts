import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Property, ListingStatus } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyAmenity } from './entities/property-amenity.entity';
import { RentalUnit } from './entities/rental-unit.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertyDto } from './dto/query-property.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { PropertyQueryBuilder } from './property-query-builder';
import { PropertyListingDraft } from './entities/property-listing-draft.entity';
import { UpdatePropertyListingWizardStepDto } from './dto/property-listing-wizard.dto';

@Injectable()
export class PropertiesService {
  findById(_propertyId: any) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(PropertyImage)
    private readonly imageRepository: Repository<PropertyImage>,
    @InjectRepository(PropertyAmenity)
    private readonly amenityRepository: Repository<PropertyAmenity>,
    @InjectRepository(RentalUnit)
    private readonly rentalUnitRepository: Repository<RentalUnit>,
    @InjectRepository(PropertyListingDraft)
    private readonly propertyListingDraftRepository: Repository<PropertyListingDraft>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private buildDefaultWizardData(): Record<string, unknown> {
    return {
      basicInfo: {},
      pricing: {},
      amenities: {},
      rules: {},
      photos: [],
      description: {},
      availability: {},
    };
  }

  private buildWizardExpiryDate(): Date {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    return expires;
  }

  private normalizeCompletedSteps(steps?: number[]): number[] {
    if (!steps?.length) return [];
    return Array.from(new Set(steps.filter((step) => step >= 1 && step <= 8)));
  }

  private mergeWizardData(
    currentData: Record<string, unknown>,
    incomingData: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...currentData,
      ...incomingData,
    };
  }

  async startWizard(
    landlordId: string,
    data?: Record<string, unknown>,
  ): Promise<PropertyListingDraft> {
    const draft = this.propertyListingDraftRepository.create({
      landlordId,
      data: {
        ...this.buildDefaultWizardData(),
        ...(data || {}),
      },
      currentStep: 1,
      completedSteps: [],
      expiresAt: this.buildWizardExpiryDate(),
    });

    return this.propertyListingDraftRepository.save(draft);
  }

  async updateWizardStep(
    draftId: string,
    landlordId: string,
    updateDto: UpdatePropertyListingWizardStepDto,
  ): Promise<PropertyListingDraft> {
    const draft = await this.propertyListingDraftRepository.findOne({
      where: { id: draftId, landlordId },
    });

    if (!draft) {
      throw new NotFoundException(`Draft with ID ${draftId} not found`);
    }

    draft.data = this.mergeWizardData(draft.data || {}, updateDto.data || {});
    draft.currentStep = updateDto.step;
    draft.completedSteps = this.normalizeCompletedSteps([
      ...(draft.completedSteps || []),
      ...(updateDto.completedSteps || []),
    ]);
    draft.expiresAt = this.buildWizardExpiryDate();

    return this.propertyListingDraftRepository.save(draft);
  }

  async getWizardDraft(
    draftId: string,
    landlordId: string,
  ): Promise<PropertyListingDraft> {
    const draft = await this.propertyListingDraftRepository.findOne({
      where: { id: draftId, landlordId },
    });

    if (!draft) {
      throw new NotFoundException(`Draft with ID ${draftId} not found`);
    }

    return draft;
  }

  async deleteWizardDraft(draftId: string, landlordId: string): Promise<void> {
    const draft = await this.getWizardDraft(draftId, landlordId);
    await this.propertyListingDraftRepository.remove(draft);
  }

  private validateWizardForPublish(data: Record<string, any>): void {
    const basicInfo = data.basicInfo || {};
    const pricing = data.pricing || {};
    const photos = Array.isArray(data.photos) ? data.photos : [];
    const description = data.description || {};
    const availability = data.availability || {};

    if (!basicInfo.propertyType || !basicInfo.address) {
      throw new BadRequestException(
        'Basic information is incomplete. Property type and address are required.',
      );
    }

    if (!pricing.monthlyRent || Number(pricing.monthlyRent) <= 0) {
      throw new BadRequestException(
        'Pricing is incomplete. Monthly rent must be greater than zero.',
      );
    }

    if (photos.length < 3) {
      throw new BadRequestException(
        'At least 3 photos are required to publish.',
      );
    }

    const descriptionText = String(
      description.propertyDescription || '',
    ).trim();
    if (descriptionText.length < 40) {
      throw new BadRequestException(
        'Property description must be at least 40 characters.',
      );
    }

    if (!availability.availableFrom) {
      throw new BadRequestException(
        'Availability is incomplete. Available from date is required.',
      );
    }
  }

  async publishWizardDraft(
    draftId: string,
    landlordId: string,
  ): Promise<Property> {
    const draft = await this.getWizardDraft(draftId, landlordId);
    const data = (draft.data || {}) as Record<string, any>;
    this.validateWizardForPublish(data);

    const basicInfo = data.basicInfo || {};
    const pricing = data.pricing || {};
    const description = data.description || {};
    const amenities = data.amenities || {};
    const rules = data.rules || {};
    const photos = Array.isArray(data.photos) ? data.photos : [];

    const createdProperty = await this.create(
      {
        title:
          String(basicInfo.title || '').trim() ||
          `${basicInfo.propertyType || 'Property'} in ${basicInfo.city || 'City'}`,
        description: String(description.propertyDescription || '').trim(),
        type: basicInfo.propertyType || 'apartment',
        address: basicInfo.address,
        city: basicInfo.city,
        state: basicInfo.state,
        postalCode: basicInfo.postalCode,
        country: basicInfo.country,
        price: Number(pricing.monthlyRent),
        currency: pricing.currency || 'USD',
        bedrooms: basicInfo.bedrooms ? Number(basicInfo.bedrooms) : undefined,
        bathrooms: basicInfo.bathrooms
          ? Number(basicInfo.bathrooms)
          : undefined,
        area: basicInfo.squareFootage
          ? Number(basicInfo.squareFootage)
          : undefined,
        isFurnished: Boolean(amenities.furnished),
        hasParking: Boolean(amenities.parking),
        petsAllowed: Boolean(rules.petsAllowed),
        metadata: {
          wizardData: data,
          moveInDate: pricing.moveInDate,
          leaseTermMonths: pricing.leaseTermMonths,
          photos,
        },
      },
      landlordId,
    );

    createdProperty.status = ListingStatus.PUBLISHED;
    const published = await this.propertyRepository.save(createdProperty);
    await this.propertyListingDraftRepository.remove(draft);
    await this.clearPropertiesCache();
    return published;
  }

  private async clearPropertiesCache(): Promise<void> {
    const store = (this.cacheManager as any).store;
    if (store.keys) {
      const keys = await store.keys('properties:list:*');
      for (const key of keys) {
        await this.cacheManager.del(key);
      }
    }
  }

  private generateCacheKey(query: QueryPropertyDto): string {
    const queryStr = JSON.stringify(query);
    const hash = crypto.createHash('md5').update(queryStr).digest('hex');
    return `properties:list:${hash}`;
  }

  async create(
    createPropertyDto: CreatePropertyDto,
    ownerId: string,
  ): Promise<Property> {
    const { images, amenities, rentalUnits, ...propertyData } =
      createPropertyDto;

    const property = this.propertyRepository.create({
      ...propertyData,
      ownerId,
      status: ListingStatus.DRAFT,
    });

    const savedProperty = await this.propertyRepository.save(property);

    if (images && images.length > 0) {
      const propertyImages = images.map((img) =>
        this.imageRepository.create({
          ...img,
          propertyId: savedProperty.id,
        }),
      );
      await this.imageRepository.save(propertyImages);
    }

    if (amenities && amenities.length > 0) {
      const propertyAmenities = amenities.map((amenity) =>
        this.amenityRepository.create({
          ...amenity,
          propertyId: savedProperty.id,
        }),
      );
      await this.amenityRepository.save(propertyAmenities);
    }

    if (rentalUnits && rentalUnits.length > 0) {
      const propertyUnits = rentalUnits.map((unit) =>
        this.rentalUnitRepository.create({
          ...unit,
          propertyId: savedProperty.id,
        }),
      );
      await this.rentalUnitRepository.save(propertyUnits);
    }

    await this.clearPropertiesCache();
    return this.findOne(savedProperty.id);
  }

  async findAll(query: QueryPropertyDto): Promise<{
    data: Property[];
    meta: {
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      ...filters
    } = query;

    // Caching logic
    const isPublicListing =
      filters.status === ListingStatus.PUBLISHED && !filters.ownerId;
    let cacheKey: string | null = null;

    if (isPublicListing) {
      cacheKey = this.generateCacheKey(query);
      const cachedData = await this.cacheManager.get<{
        data: Property[];
        meta: {
          total: number;
          page: number;
          limit: number;
        };
      }>(cacheKey);

      if (cachedData) {
        return cachedData;
      }
    }

    // Create base query with relations
    const baseQuery = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'images')
      .leftJoinAndSelect('property.amenities', 'amenities')
      .leftJoinAndSelect('property.owner', 'owner');

    // Use PropertyQueryBuilder for clean, maintainable query building
    const propertyQueryBuilder = new PropertyQueryBuilder(baseQuery);

    const [data, total] = await propertyQueryBuilder
      .applyFilters(filters)
      .applySorting(sortBy, sortOrder)
      .applyPagination(page, limit)
      .execute();

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };

    // Cache public listings
    if (isPublicListing && cacheKey) {
      await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
    }

    return result;
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      relations: ['images', 'amenities', 'rentalUnits', 'owner'],
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return property;
  }

  async findOnePublic(id: string): Promise<Property> {
    const property = await this.findOne(id);

    if (property.status !== ListingStatus.PUBLISHED) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return property;
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    user: User,
  ): Promise<Property> {
    const property = await this.findOne(id);
    this.verifyOwnership(property, user);

    const { images, amenities, rentalUnits, ...propertyData } =
      updatePropertyDto;

    Object.assign(property, propertyData);
    await this.propertyRepository.save(property);

    if (images !== undefined) {
      await this.imageRepository.delete({ propertyId: id });
      if (images.length > 0) {
        const propertyImages = images.map((img) =>
          this.imageRepository.create({
            ...img,
            propertyId: id,
          }),
        );
        await this.imageRepository.save(propertyImages);
      }
    }

    if (amenities !== undefined) {
      await this.amenityRepository.delete({ propertyId: id });
      if (amenities.length > 0) {
        const propertyAmenities = amenities.map((amenity) =>
          this.amenityRepository.create({
            ...amenity,
            propertyId: id,
          }),
        );
        await this.amenityRepository.save(propertyAmenities);
      }
    }

    if (rentalUnits !== undefined) {
      await this.rentalUnitRepository.delete({ propertyId: id });
      if (rentalUnits.length > 0) {
        const propertyUnits = rentalUnits.map((unit) =>
          this.rentalUnitRepository.create({
            ...unit,
            propertyId: id,
          }),
        );
        await this.rentalUnitRepository.save(propertyUnits);
      }
    }

    await this.clearPropertiesCache();
    return this.findOne(id);
  }

  async remove(id: string, user: User): Promise<void> {
    const property = await this.findOne(id);
    this.verifyOwnership(property, user);
    await this.propertyRepository.remove(property);
    await this.clearPropertiesCache();
  }

  async publish(id: string, user: User): Promise<Property> {
    const property = await this.findOne(id);
    this.verifyOwnership(property, user);

    if (property.status === ListingStatus.PUBLISHED) {
      throw new BadRequestException('Property is already published');
    }

    if (property.status === ListingStatus.ARCHIVED) {
      throw new BadRequestException(
        'Cannot publish an archived property. Please create a new listing.',
      );
    }

    if (
      !property.title ||
      property.price === null ||
      property.price === undefined
    ) {
      throw new BadRequestException(
        'Property must have at least a title and price to be published',
      );
    }

    property.status = ListingStatus.PUBLISHED;
    const saved = await this.propertyRepository.save(property);
    await this.clearPropertiesCache();
    return saved;
  }

  async archive(id: string, user: User): Promise<Property> {
    const property = await this.findOne(id);
    this.verifyOwnership(property, user);
    property.status = ListingStatus.ARCHIVED;
    const saved = await this.propertyRepository.save(property);
    await this.clearPropertiesCache();
    return saved;
  }

  async markAsRented(id: string, user: User): Promise<Property> {
    const property = await this.findOne(id);
    this.verifyOwnership(property, user);
    property.status = ListingStatus.RENTED;
    const saved = await this.propertyRepository.save(property);
    await this.clearPropertiesCache();
    return saved;
  }

  private verifyOwnership(property: Property, user: User): void {
    if (property.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to modify this property',
      );
    }
  }
}
